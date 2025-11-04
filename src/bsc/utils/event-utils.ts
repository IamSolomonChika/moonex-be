import { Address, Hash, PublicClient, Abi, Log } from 'viem';
import { getViemProvider } from '../providers/viem-provider';
import { ViemEventFilter, ViemEventLog, WebSocketSubscription } from '../../types/viem';
import logger from '../../utils/logger';

/**
 * Event Monitoring Utilities
 * Provides utilities for monitoring, filtering, and parsing blockchain events with Viem
 */

class EventUtils {
  private provider = getViemProvider();
  private subscriptions: Map<string, WebSocketSubscription> = new Map();
  private eventCache: Map<string, Log[]> = new Map();
  private isListening = false;

  /**
   * Setup event listeners for contracts
   */
  public setupEventListeners(
    contractAddress: Address,
    abi: Abi,
    eventName: string,
    callback: (log: Log) => void,
    options?: {
      fromBlock?: bigint;
      toBlock?: bigint;
    }
  ): string {
    const subscriptionId = `event_${contractAddress}_${eventName}_${Date.now()}`;

    try {
      const client = this.provider.getWebSocketClient();

      // Create event filter
      const event = abi.find(item => item.type === 'event' && item.name === eventName);
      if (!event) {
        throw new Error(`Event ${eventName} not found in ABI`);
      }

      const filter = {
        address: contractAddress,
        topics: [this.getEventTopic(event)],
        fromBlock: options?.fromBlock || 'latest',
        toBlock: options?.toBlock,
      };

      // Subscribe to new events
      const unwatch = client.watchEvent({
        ...filter,
        onLogs: (logs) => {
          logs.forEach(log => {
            logger.debug('New event received: %s from %s', eventName, contractAddress);
            callback(log);
          });
        },
      });

      // Store subscription
      const subscription: WebSocketSubscription = {
        id: subscriptionId,
        type: 'logs',
        filter,
        callback,
      };

      this.subscriptions.set(subscriptionId, {
        ...subscription,
        callback: () => unwatch(),
      });

      logger.info('Event listener setup for %s on contract %s', eventName, contractAddress);
      return subscriptionId;
    } catch (error) {
      logger.error('Failed to setup event listener: %O', error);
      throw error;
    }
  }

  /**
   * Setup new block listener
   */
  public setupNewBlockListener(callback: (blockNumber: bigint) => void): string {
    const subscriptionId = `blocks_${Date.now()}`;

    try {
      const client = this.provider.getWebSocketClient();

      const unwatch = client.watchBlockNumber({
        onBlockNumber: (blockNumber) => {
          logger.debug('New block: %d', blockNumber);
          callback(blockNumber);
        },
      });

      const subscription: WebSocketSubscription = {
        id: subscriptionId,
        type: 'newBlocks',
        callback,
      };

      this.subscriptions.set(subscriptionId, {
        ...subscription,
        callback: () => unwatch(),
      });

      logger.info('New block listener setup with ID: %s', subscriptionId);
      return subscriptionId;
    } catch (error) {
      logger.error('Failed to setup new block listener: %O', error);
      throw error;
    }
  }

  /**
   * Setup pending transaction listener
   */
  public setupPendingTransactionListener(callback: (txHash: Hash) => void): string {
    const subscriptionId = `pending_${Date.now()}`;

    try {
      const client = this.provider.getWebSocketClient();

      const unwatch = client.watchPendingTransactions({
        onTransactions: (transactions) => {
          transactions.forEach(txHash => {
            logger.debug('Pending transaction: %s', txHash);
            callback(txHash);
          });
        },
      });

      const subscription: WebSocketSubscription = {
        id: subscriptionId,
        type: 'pendingTransactions',
        callback,
      };

      this.subscriptions.set(subscriptionId, {
        ...subscription,
        callback: () => unwatch(),
      });

      logger.info('Pending transaction listener setup with ID: %s', subscriptionId);
      return subscriptionId;
    } catch (error) {
      logger.error('Failed to setup pending transaction listener: %O', error);
      throw error;
    }
  }

  /**
   * Get historical events
   */
  public async getHistoricalEvents(
    contractAddress: Address,
    abi: Abi,
    eventName: string,
    options?: {
      fromBlock?: bigint;
      toBlock?: bigint;
    }
  ): Promise<Log[]> {
    const cacheKey = `events_${contractAddress}_${eventName}_${options?.fromBlock}_${options?.toBlock}`;

    try {
      const client = this.provider.getHttpClient();

      // Check cache first
      const cached = this.eventCache.get(cacheKey);
      if (cached) {
        logger.debug('Using cached events for %s', eventName);
        return cached;
      }

      // Create event filter
      const event = abi.find(item => item.type === 'event' && item.name === eventName);
      if (!event) {
        throw new Error(`Event ${eventName} not found in ABI`);
      }

      const filter = {
        address: contractAddress,
        topics: [this.getEventTopic(event)],
        fromBlock: options?.fromBlock || BigInt(0),
        toBlock: options?.toBlock || 'latest',
      };

      logger.debug('Fetching historical events for %s from %s to %s', eventName, filter.fromBlock, filter.toBlock);

      const logs = await client.getLogs(filter);

      // Cache the results
      this.eventCache.set(cacheKey, logs);

      logger.info('Retrieved %d historical events for %s', logs.length, eventName);
      return logs;
    } catch (error) {
      logger.error('Failed to get historical events: %O', error);
      throw error;
    }
  }

  /**
   * Filter events by criteria
   */
  public filterEvents(
    events: Log[],
    filter: Partial<{
      address: Address;
      topics: Array<(string | string[] | null)>;
      fromBlock: bigint;
      toBlock: bigint;
    }>
  ): Log[] {
    return events.filter(event => {
      // Address filter
      if (filter.address && event.address !== filter.address) {
        return false;
      }

      // Topics filter
      if (filter.topics) {
        for (let i = 0; i < filter.topics.length; i++) {
          const filterTopic = filter.topics[i];
          if (filterTopic !== null && filterTopic !== undefined) {
            const eventTopic = event.topics[i];
            if (Array.isArray(filterTopic)) {
              if (!eventTopic || !filterTopic.includes(eventTopic)) {
                return false;
              }
            } else if (eventTopic !== filterTopic) {
              return false;
            }
          }
        }
      }

      return true;
    });
  }

  /**
   * Parse event logs using ABI
   */
  public parseEventLogs(logs: Log[], abi: Abi): Array<{
    log: Log;
    eventName: string;
    args: any;
  }> {
    const client = this.provider.getHttpClient();

    return logs.map(log => {
      try {
        const parsedLog = client.parseEventLog({
          log,
          abi,
        });

        return {
          log,
          eventName: parsedLog.eventName,
          args: parsedLog.args,
        };
      } catch (error) {
        logger.error('Failed to parse event log: %O', error);
        return {
          log,
          eventName: 'unknown',
          args: {},
        };
      }
    });
  }

  /**
   * Get transfer events for a token
   */
  public async getTokenTransferEvents(
    tokenAddress: Address,
    options?: {
      fromAddress?: Address;
      toAddress?: Address;
      fromBlock?: bigint;
      toBlock?: bigint;
    }
  ): Promise<Log[]> {
    try {
      const client = this.provider.getHttpClient();

      // Build transfer event filter
      const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'; // Transfer(address,address,uint256)
      const topics = [transferTopic];

      // Add from/to address filters if provided
      if (options?.fromAddress || options?.toAddress) {
        const fromTopic = options?.fromAddress ? options.fromAddress.toLowerCase().padStart(64, '0') : null;
        const toTopic = options?.toAddress ? options.toAddress.toLowerCase().padStart(64, '0') : null;
        topics.push(fromTopic, toTopic);
      }

      const filter = {
        address: tokenAddress,
        topics,
        fromBlock: options?.fromBlock || BigInt(0),
        toBlock: options?.toBlock || 'latest',
      };

      const logs = await client.getLogs(filter);

      logger.info('Retrieved %d transfer events for token %s', logs.length, tokenAddress);
      return logs;
    } catch (error) {
      logger.error('Failed to get transfer events: %O', error);
      throw error;
    }
  }

  /**
   * Get swap events for PancakeSwap
   */
  public async getSwapEvents(
    pairAddress: Address,
    options?: {
      fromBlock?: bigint;
      toBlock?: bigint;
    }
  ): Promise<Log[]> {
    try {
      const client = this.provider.getHttpClient();

      // Swap event topic
      const swapTopic = '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822'; // Swap(address,uint256,uint256,uint256,uint256,address)

      const filter = {
        address: pairAddress,
        topics: [swapTopic],
        fromBlock: options?.fromBlock || BigInt(0),
        toBlock: options?.toBlock || 'latest',
      };

      const logs = await client.getLogs(filter);

      logger.info('Retrieved %d swap events for pair %s', logs.length, pairAddress);
      return logs;
    } catch (error) {
      logger.error('Failed to get swap events: %O', error);
      throw error;
    }
  }

  /**
   * Unsubscribe from event listener
   */
  public unsubscribe(subscriptionId: string): boolean {
    try {
      const subscription = this.subscriptions.get(subscriptionId);
      if (subscription) {
        subscription.callback();
        this.subscriptions.delete(subscriptionId);
        logger.info('Unsubscribed from event listener: %s', subscriptionId);
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Failed to unsubscribe from %s: %O', subscriptionId, error);
      return false;
    }
  }

  /**
   * Unsubscribe from all event listeners
   */
  public unsubscribeAll(): void {
    const subscriptionIds = Array.from(this.subscriptions.keys());

    subscriptionIds.forEach(id => {
      this.unsubscribe(id);
    });

    logger.info('Unsubscribed from all event listeners');
  }

  /**
   * Get active subscriptions
   */
  public getActiveSubscriptions(): Array<{
    id: string;
    type: string;
    filter?: any;
  }> {
    return Array.from(this.subscriptions.values()).map(sub => ({
      id: sub.id,
      type: sub.type,
      filter: sub.filter,
    }));
  }

  /**
   * Clear event cache
   */
  public clearEventCache(): void {
    this.eventCache.clear();
    logger.info('Event cache cleared');
  }

  /**
   * Get event statistics
   */
  public getEventStatistics(): {
    activeSubscriptions: number;
    cachedEventSets: number;
    isListening: boolean;
  } {
    return {
      activeSubscriptions: this.subscriptions.size,
      cachedEventSets: this.eventCache.size,
      isListening: this.isListening,
    };
  }

  /**
   * Get event topic from ABI event definition
   */
  private getEventTopic(event: any): string {
    // This is a simplified version - in a real implementation,
    // you would use keccak256 to hash the event signature
    const signature = `${event.name}(${event.inputs?.map((input: any) => input.type).join(',')})`;
    logger.debug('Event signature: %s', signature);

    // For now, return some known event topics
    const knownTopics: Record<string, string> = {
      'Transfer(address,address,uint256)': '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
      'Swap(address,uint256,uint256,uint256,uint256,address)': '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822',
      'Approval(address,address,uint256)': '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925',
      'Sync(uint112,uint112)': '0x1c411e9a96e071241c2f21f7726b17ae89e3cab4c78be50e062b03a9fffbbad1',
    };

    return knownTopics[signature] || '0x' + '0'.repeat(64); // Return zero hash if not found
  }
}

// Singleton instance
let eventUtils: EventUtils | null = null;

/**
 * Get event utils singleton instance
 */
export const getEventUtils = (): EventUtils => {
  if (!eventUtils) {
    eventUtils = new EventUtils();
  }
  return eventUtils;
};

// Convenience exports
export const setupEventListeners = (
  contractAddress: Address,
  abi: Abi,
  eventName: string,
  callback: (log: Log) => void,
  options?: { fromBlock?: bigint; toBlock?: bigint }
) => getEventUtils().setupEventListeners(contractAddress, abi, eventName, callback, options);

export const getHistoricalEvents = (
  contractAddress: Address,
  abi: Abi,
  eventName: string,
  options?: { fromBlock?: bigint; toBlock?: bigint }
) => getEventUtils().getHistoricalEvents(contractAddress, abi, eventName, options);

export const filterEvents = (
  events: Log[],
  filter: Partial<{
    address: Address;
    topics: Array<(string | string[] | null)>;
    fromBlock: bigint;
    toBlock: bigint;
  }>
) => getEventUtils().filterEvents(events, filter);

export const parseEventLogs = (logs: Log[], abi: Abi) =>
  getEventUtils().parseEventLogs(logs, abi);

export { EventUtils };
export default getEventUtils;