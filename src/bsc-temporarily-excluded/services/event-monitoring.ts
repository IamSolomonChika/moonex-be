import { ethers, JsonRpcProvider, EventLog, Filter, Log } from 'ethers';
import { bscConfig } from '../config';
import { bscProviderManager } from '../utils/ethers-provider';
import logger from '../../utils/logger';

/**
 * Event monitoring configuration
 */
export interface EventMonitoringConfig {
  contractAddress: string;
  eventTopics?: string[];
  fromBlock?: number;
  toBlock?: 'latest' | number;
  batchSize?: number;
  pollInterval?: number;
}

/**
 * Parsed event data
 */
export interface ParsedEvent {
  contractAddress: string;
  eventName: string;
  blockNumber: number;
  transactionHash: string;
  args: Record<string, any>;
  timestamp: number;
}

/**
 * Event handler function type
 */
export type EventHandler = (event: ParsedEvent) => Promise<void> | void;

/**
 * BSC Event Monitor
 * Handles blockchain event monitoring for PancakeSwap and other BSC contracts
 */
export class BSCEventMonitor {
  private provider: JsonRpcProvider | null = null;
  private eventHandlers = new Map<string, EventHandler[]>();
  private isMonitoring = new Map<string, boolean>();
  private pollIntervals = new Map<string, NodeJS.Timeout>();

  constructor() {
    // Provider will be initialized lazily or explicitly
  }

  /**
   * Get or initialize provider
   */
  private getProvider(): JsonRpcProvider {
    if (!this.provider) {
      this.provider = bscProviderManager.getProvider();
    }
    return this.provider;
  }

  /**
   * Initialize with specific provider
   */
  public initialize(provider: JsonRpcProvider): void {
    this.provider = provider;
  }

  /**
   * Register event handler for a specific event
   */
  public registerEventHandler(
    contractAddress: string,
    eventName: string,
    handler: EventHandler
  ): void {
    const key = `${contractAddress}:${eventName}`;
    if (!this.eventHandlers.has(key)) {
      this.eventHandlers.set(key, []);
    }
    this.eventHandlers.get(key)!.push(handler);
  }

  /**
   * Unregister event handlers for a contract
   */
  public unregisterEventHandlers(contractAddress: string, eventName?: string): void {
    if (eventName) {
      const key = `${contractAddress}:${eventName}`;
      this.eventHandlers.delete(key);
    } else {
      // Remove all handlers for this contract
      for (const [key] of this.eventHandlers.entries()) {
        if (key.startsWith(`${contractAddress}:`)) {
          this.eventHandlers.delete(key);
        }
      }
    }
  }

  /**
   * Start monitoring events for a contract
   */
  public async startMonitoring(config: EventMonitoringConfig): Promise<void> {
    const key = config.contractAddress;

    if (this.isMonitoring.get(key)) {
      logger.warn(`Already monitoring events for contract ${key}`);
      return;
    }

    try {
      this.isMonitoring.set(key, true);
      await this.monitorEvents(config);
      logger.info(`Started monitoring events for contract ${key}`);

    } catch (error) {
      this.isMonitoring.set(key, false);
      logger.error({ contractAddress: key, error: error instanceof Error ? error.message : 'Unknown error' }, `Failed to start monitoring events for contract ${key}`);
      throw error;
    }
  }

  /**
   * Stop monitoring events for a contract
   */
  public stopMonitoring(contractAddress: string): void {
    const interval = this.pollIntervals.get(contractAddress);
    if (interval) {
      clearInterval(interval);
      this.pollIntervals.delete(contractAddress);
    }

    this.isMonitoring.set(contractAddress, false);
    logger.info(`Stopped monitoring events for contract ${contractAddress}`);
  }

  /**
   * Get historical events
   */
  public async getHistoricalEvents(
    config: EventMonitoringConfig
  ): Promise<ParsedEvent[]> {
    try {
      const filter: Filter = {
        address: config.contractAddress,
        topics: config.eventTopics,
        fromBlock: config.fromBlock || (await this.getProvider().getBlockNumber()) - 1000,
        toBlock: config.toBlock || 'latest',
      };

      const logs = await this.getProvider().getLogs(filter);
      return await this.parseEventLogs(logs);

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to fetch historical events');
      throw new Error(`Failed to fetch historical events: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Core event monitoring logic
   */
  private async monitorEvents(config: EventMonitoringConfig): Promise<void> {
    const {
      contractAddress,
      batchSize = 1000,
      pollInterval = 5000, // 5 seconds for BSC's fast blocks
    } = config;

    let lastProcessedBlock = config.fromBlock || await this.getProvider().getBlockNumber();

    const poll = async () => {
      try {
        if (!this.isMonitoring.get(contractAddress)) {
          return; // Stop if monitoring was stopped
        }

        const currentBlock = await this.getProvider().getBlockNumber();
        if (currentBlock <= lastProcessedBlock) {
          return; // No new blocks
        }

        // Get events in batches
        const fromBlock = lastProcessedBlock + 1;
        const toBlock = Math.min(fromBlock + batchSize - 1, currentBlock);

        const filter: Filter = {
          address: contractAddress,
          topics: config.eventTopics,
          fromBlock,
          toBlock,
        };

        const logs = await this.getProvider().getLogs(filter);

        if (logs.length > 0) {
          const events = await this.parseEventLogs(logs);
          await this.processEvents(events);
        }

        lastProcessedBlock = toBlock;

      } catch (error) {
        logger.error({ contractAddress, error: error instanceof Error ? error.message : 'Unknown error' }, `Error monitoring events for ${contractAddress}`);
      }
    };

    // Start polling
    const interval = setInterval(poll, pollInterval);
    this.pollIntervals.set(contractAddress, interval);
  }

  /**
   * Parse raw event logs
   */
  private async parseEventLogs(logs: Log[]): Promise<ParsedEvent[]> {
    const events: ParsedEvent[] = [];

    for (const log of logs) {
      try {
        // Get block timestamp
        const block = await this.getProvider().getBlock(log.blockNumber);
        const timestamp = block?.timestamp || Date.now() / 1000;

        // Parse the event (this is a simplified parser)
        const eventName = this.getEventNameFromTopics([...log.topics]);
        const args = this.parseEventArgs(log);

        const event: ParsedEvent = {
          contractAddress: log.address,
          eventName,
          blockNumber: log.blockNumber,
          transactionHash: log.transactionHash,
          args,
          timestamp,
        };

        events.push(event);

      } catch (error) {
        logger.error({ log: JSON.stringify(log), error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to parse event log');
      }
    }

    return events;
  }

  /**
   * Process parsed events
   */
  private async processEvents(events: ParsedEvent[]): Promise<void> {
    for (const event of events) {
      try {
        const key = `${event.contractAddress}:${event.eventName}`;
        const handlers = this.eventHandlers.get(key) || [];

        // Execute all registered handlers
        await Promise.all(
          handlers.map(async handler => {
            try {
              await handler(event);
            } catch (error) {
              logger.error({ eventName: event.eventName, error: error instanceof Error ? error.message : 'Unknown error' }, `Event handler error for ${event.eventName}`);
            }
          })
        );

      } catch (error) {
        logger.error({ event: JSON.stringify(event), error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to process event');
      }
    }
  }

  /**
   * Get event name from topics (simplified)
   */
  private getEventNameFromTopics(topics: string[]): string {
    // This is a simplified implementation
    // In a real implementation, you'd use the contract ABI to decode events
    if (topics.length === 0) return 'Unknown';

    // Try to extract event signature from first topic
    const eventSignature = topics[0];
    const knownEvents: Record<string, string> = {
      '0x1c411e9a96e071241c2f21f7726b17ae89e3cab4c78be50e062b03a9fffbbad1': 'Swap',
      '0x4c209b5fc8ad50758f13e2e1088ba56a560dff690a1c6fef26394f4c03821c1f': 'Sync',
      '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822': 'Mint',
      '0x89afcb44d3532f5c38d9e1ea622558e4c1c69bb09b6c899373597f5c7f5a8f1d': 'Burn',
    };

    return knownEvents[eventSignature] || 'Unknown';
  }

  /**
   * Parse event args (simplified)
   */
  private parseEventArgs(log: Log): Record<string, any> {
    // This is a simplified implementation
    // In a real implementation, you'd use ethers' Interface to decode the event

    if (log.topics.length < 2) return {};

    // Simple parsing for common events
    const eventName = this.getEventNameFromTopics([...log.topics]);

    switch (eventName) {
      case 'Swap':
        return {
          amount0In: log.topics[2],
          amount1In: log.topics[3],
          to: log.topics[4],
        };

      case 'Sync':
        return {
          reserve0: log.topics[2],
          reserve1: log.topics[3],
        };

      default:
        return {
          data: log.data,
          topics: log.topics,
        };
    }
  }

  /**
   * Get monitoring statistics
   */
  public getStatistics(): {
    totalContracts: number;
    activeContracts: number;
    totalEventHandlers: number;
    contractDetails: Array<{
      address: string;
      isMonitoring: boolean;
      eventHandlers: number;
    }>;
  } {
    const contractAddresses = new Set<string>();
    let totalEventHandlers = 0;

    for (const [key] of this.eventHandlers.entries()) {
      const [address] = key.split(':');
      contractAddresses.add(address);
      totalEventHandlers++;
    }

    const contractDetails = Array.from(contractAddresses).map(address => ({
      address,
      isMonitoring: this.isMonitoring.get(address) || false,
      eventHandlers: Array.from(this.eventHandlers.keys())
        .filter(key => key.startsWith(`${address}:`))
        .length,
    }));

    return {
      totalContracts: contractAddresses.size,
      activeContracts: Array.from(this.isMonitoring.values()).filter(Boolean).length,
      totalEventHandlers,
      contractDetails,
    };
  }

  /**
   * Health check
   */
  public async healthCheck(): Promise<boolean> {
    try {
      await this.getProvider().getBlockNumber();
      return true;
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Event monitor health check failed');
      return false;
    }
  }
}

// Export singleton instance
export const bscEventMonitor = new BSCEventMonitor();

// Export convenience functions
export const registerEventHandler = (
  contractAddress: string,
  eventName: string,
  handler: EventHandler
) => bscEventMonitor.registerEventHandler(contractAddress, eventName, handler);

export const startMonitoring = (config: EventMonitoringConfig) =>
  bscEventMonitor.startMonitoring(config);

export const getHistoricalEvents = (config: EventMonitoringConfig) =>
  bscEventMonitor.getHistoricalEvents(config);