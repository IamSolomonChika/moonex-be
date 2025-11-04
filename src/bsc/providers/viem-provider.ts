import { createPublicClient, createWalletClient, http, webSocket, fallback, Chain, Account, Transport } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { getCurrentChainConfig, createWebSocketTransport, createHttpTransport, VIEM_CONFIG } from '../../config/viem';
import logger from '../../utils/logger';
import { CacheService } from '../../services/cache.service';

/**
 * Viem Provider Management
 * Provides Viem clients for BSC blockchain interactions with connection pooling and failover
 */

// Connection pool for public clients
interface ClientPool {
  clients: Array<any>;
  currentIndex: number;
  maxSize: number;
}

class ViemProvider {
  private httpPool: ClientPool;
  private wsClient: any = null;
  private walletClients: Map<string, any> = new Map();
  private cache: CacheService;
  private isConnecting: boolean = false;
  private connectionAttempts: number = 0;

  constructor() {
    this.cache = new CacheService();
    this.httpPool = {
      clients: [],
      currentIndex: 0,
      maxSize: 5, // Connection pool size
    };
    this.initializeClients();
  }

  /**
   * Initialize Viem clients
   */
  private async initializeClients(): Promise<void> {
    if (this.isConnecting) return;

    this.isConnecting = true;
    try {
      const { config } = getCurrentChainConfig();

      // Create HTTP client pool
      for (let i = 0; i < this.httpPool.maxSize; i++) {
        const client = createPublicClient({
          ...config,
          transport: createHttpTransport(),
        });
        this.httpPool.clients.push(client);
      }

      // Create WebSocket client if enabled
      if (VIEM_CONFIG.ENABLE_WEBSOCKETS) {
        this.wsClient = createPublicClient({
          chain: getCurrentChainConfig().chain,
          transport: createWebSocketTransport(),
        });
      }

      // Test connectivity
      await this.testConnectivity();

      logger.info('Viem providers initialized successfully');
      logger.info('HTTP pool size: %d', this.httpPool.maxSize);
      logger.info('WebSocket client: %s', this.wsClient ? 'Connected' : 'Disabled');

    } catch (error) {
      logger.error('Failed to initialize Viem providers: %O', error);
      throw error;
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * Test provider connectivity
   */
  private async testConnectivity(): Promise<void> {
    try {
      const client = this.getHttpClient();
      const chainId = await client.getChainId();
      const blockNumber = await client.getBlockNumber();

      logger.info('Connectivity test passed - Chain ID: %d, Block: %d', chainId, blockNumber);
      this.connectionAttempts = 0;
    } catch (error) {
      this.connectionAttempts++;
      logger.error('Connectivity test failed (attempt %d): %O', this.connectionAttempts, error);

      if (this.connectionAttempts >= VIEM_CONFIG.MAX_RETRIES) {
        throw new Error(`Failed to establish blockchain connection after ${VIEM_CONFIG.MAX_RETRIES} attempts`);
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, VIEM_CONFIG.RETRY_DELAY));
      return this.testConnectivity();
    }
  }

  /**
   * Get HTTP client from pool (round-robin)
   */
  public getHttpClient(): any {
    if (this.httpPool.clients.length === 0) {
      throw new Error('HTTP client pool not initialized');
    }

    const client = this.httpPool.clients[this.httpPool.currentIndex];
    this.httpPool.currentIndex = (this.httpPool.currentIndex + 1) % this.httpPool.maxSize;
    return client;
  }

  /**
   * Get WebSocket client
   */
  public getWebSocketClient(): any {
    if (!this.wsClient) {
      throw new Error('WebSocket client not initialized or disabled');
    }
    return this.wsClient;
  }

  /**
   * Create wallet client for private key
   */
  public createWalletClient(privateKey: string): any {
    const cacheKey = `wallet_${privateKey.slice(0, 8)}`;

    // Check cache first
    const cachedClient = this.cache.get(cacheKey);
    if (cachedClient) {
      return cachedClient;
    }

    try {
      const account = privateKeyToAccount(privateKey as `0x${string}`);
      const walletClient = createWalletClient({
        account,
        chain: getCurrentChainConfig().chain,
        transport: createHttpTransport(),
      });

      // Cache the client
      this.cache.set(cacheKey, walletClient, VIEM_CONFIG.CACHE_TTL);

      // Store in memory for quick access
      this.walletClients.set(cacheKey, walletClient);

      logger.info('Created wallet client for address: %s', account.address);
      return walletClient;
    } catch (error) {
      logger.error('Failed to create wallet client: %O', error);
      throw new Error(`Failed to create wallet client: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get cached wallet client
   */
  public getWalletClient(privateKey: string): any {
    const cacheKey = `wallet_${privateKey.slice(0, 8)}`;
    return this.walletClients.get(cacheKey);
  }

  /**
   * Create batch client for multiple requests
   */
  public createBatchClient(): any {
    const client = this.getHttpClient();
    return client.extend({
      batch: {
        multicall: true,
        batchSize: VIEM_CONFIG.BATCH_SIZE,
      },
    });
  }

  /**
   * Get client with specific transport type
   */
  public getClient(transportType: 'http' | 'websocket' | 'fallback' = 'http'): any {
    switch (transportType) {
      case 'http':
        return this.getHttpClient();
      case 'websocket':
        return this.getWebSocketClient();
      case 'fallback':
        return createPublicClient({
          chain: getCurrentChainConfig().chain,
          transport: fallback([
            createHttpTransport(),
            webSocket(VIEM_CONFIG.BSC_WSS_URL),
          ]),
        });
      default:
        return this.getHttpClient();
    }
  }

  /**
   * Reconnect WebSocket client
   */
  public async reconnectWebSocket(): Promise<void> {
    if (!VIEM_CONFIG.ENABLE_WEBSOCKETS) return;

    try {
      logger.info('Reconnecting WebSocket client...');
      this.wsClient = createPublicClient({
        chain: getCurrentChainConfig().chain,
        transport: createWebSocketTransport(),
      });

      await this.testConnectivity();
      logger.info('WebSocket client reconnected successfully');
    } catch (error) {
      logger.error('Failed to reconnect WebSocket client: %O', error);
      throw error;
    }
  }

  /**
   * Get provider status
   */
  public getStatus(): {
    httpPool: { size: number; available: number };
    webSocket: { connected: boolean };
    walletClients: number;
    connectionAttempts: number;
  } {
    return {
      httpPool: {
        size: this.httpPool.maxSize,
        available: this.httpPool.clients.length,
      },
      webSocket: {
        connected: this.wsClient !== null,
      },
      walletClients: this.walletClients.size,
      connectionAttempts: this.connectionAttempts,
    };
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    this.httpPool.clients = [];
    this.wsClient = null;
    this.walletClients.clear();
    this.cache.clear();
    logger.info('Viem provider cleanup completed');
  }
}

// Singleton instance
let viemProvider: ViemProvider | null = null;

/**
 * Get Viem provider singleton instance
 */
export const getViemProvider = (): ViemProvider => {
  if (!viemProvider) {
    viemProvider = new ViemProvider();
  }
  return viemProvider;
};

/**
 * Create Viem HTTP client (convenience function)
 */
export const createViemClient = () => {
  return getViemProvider().getHttpClient();
};

/**
 * Create Viem WebSocket client (convenience function)
 */
export const createWebSocketClient = () => {
  return getViemProvider().getWebSocketClient();
};

/**
 * Create Viem wallet client (convenience function)
 */
export const createViemWalletClient = (privateKey: string) => {
  return getViemProvider().createWalletClient(privateKey);
};

/**
 * Get provider status (convenience function)
 */
export const getProviderStatus = () => {
  return getViemProvider().getStatus();
};

export { ViemProvider };
export default getViemProvider;