import { ethers, JsonRpcProvider, WebSocketProvider, BrowserProvider } from 'ethers';
import { bscConfig } from '../config';

/**
 * BSC Provider Types
 */
export type BSCProvider = JsonRpcProvider | WebSocketProvider | BrowserProvider;

/**
 * BSC Provider Manager
 * Handles provider creation, failover, and connection management
 */
export class BSCProviderManager {
  private providers: JsonRpcProvider[] = [];
  private currentProviderIndex = 0;

  constructor() {
    this.initializeProviders();
  }

  /**
   * Initialize primary and fallback providers
   */
  private initializeProviders(): void {
    // Primary provider
    const primaryProvider = new ethers.JsonRpcProvider(bscConfig.rpcUrls.primary, {
      chainId: bscConfig.chainId,
      name: bscConfig.chainId === 56 ? 'bsc' : 'bsc-testnet',
    });
    this.providers.push(primaryProvider);

    // Fallback providers
    bscConfig.rpcUrls.fallback.forEach((rpcUrl) => {
      const fallbackProvider = new ethers.JsonRpcProvider(rpcUrl, {
        chainId: bscConfig.chainId,
        name: bscConfig.chainId === 56 ? 'bsc' : 'bsc-testnet',
      });
      this.providers.push(fallbackProvider);
    });
  }

  /**
   * Get current provider with automatic failover
   */
  public getProvider(): JsonRpcProvider {
    if (this.providers.length === 0) {
      throw new Error('No BSC providers available');
    }
    return this.providers[this.currentProviderIndex];
  }

  /**
   * Switch to next available provider
   */
  public async switchProvider(): Promise<void> {
    if (this.providers.length <= 1) {
      throw new Error('No fallback providers available');
    }

    // Try next provider
    this.currentProviderIndex = (this.currentProviderIndex + 1) % this.providers.length;
    const newProvider = this.providers[this.currentProviderIndex];

    // Test connection
    try {
      await newProvider.getBlockNumber();
      console.log(`✅ Switched to BSC provider ${this.currentProviderIndex + 1}`);
    } catch (error) {
      console.error(`❌ Failed to connect to provider ${this.currentProviderIndex + 1}:`, error);
      // Try next provider recursively
      await this.switchProvider();
    }
  }

  /**
   * Execute provider operation with automatic failover
   */
  public async executeWithFailover<T>(
    operation: (provider: JsonRpcProvider) => Promise<T>
  ): Promise<T> {
    const maxRetries = this.providers.length;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const provider = this.getProvider();
        return await operation(provider);
      } catch (error) {
        lastError = error as Error;
        console.error(`Provider ${this.currentProviderIndex + 1} failed:`, error);

        if (attempt < maxRetries - 1) {
          await this.switchProvider();
        }
      }
    }

    throw lastError || new Error('All BSC providers failed');
  }

  /**
   * Get provider for browser environment (e.g., MetaMask)
   */
  public getBrowserProvider(): BrowserProvider | null {
    if (typeof window !== 'undefined' && window.ethereum) {
      try {
        return new ethers.BrowserProvider(window.ethereum, 'any');
      } catch (error) {
        console.error('Failed to create browser provider:', error);
      }
    }
    return null;
  }

  /**
   * Check if provider is connected and responsive
   */
  public async isProviderHealthy(provider?: JsonRpcProvider): Promise<boolean> {
    try {
      const testProvider = provider || this.getProvider();
      const blockNumber = await testProvider.getBlockNumber();
      return blockNumber > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get network information
   */
  public async getNetworkInfo(): Promise<{
    chainId: number;
    name: string;
    blockNumber: number;
  }> {
    return this.executeWithFailover(async (provider) => {
      const network = await provider.getNetwork();
      const blockNumber = await provider.getBlockNumber();

      return {
        chainId: Number(network.chainId),
        name: network.name || 'unknown',
        blockNumber,
      };
    });
  }
}

// Export singleton instance
export const bscProviderManager = new BSCProviderManager();

// Export convenience functions
export const getBSCProvider = () => bscProviderManager.getProvider();
export const executeWithFailover = <T>(
  operation: (provider: JsonRpcProvider) => Promise<T>
) => bscProviderManager.executeWithFailover(operation);

// Export types for browser compatibility
declare global {
  interface Window {
    ethereum?: any;
  }
}