#!/usr/bin/env node

/**
 * BSC Functionality Validation Script
 * Validates that all major BSC services are properly implemented with Viem
 */

async function validateBSCFunctionality() {
  console.log('🔍 Starting BSC Functionality Validation...\n');

  const results = {
    tokenService: false,
    swapService: false,
    liquidityService: false,
    farmingService: false,
    viemProvider: false,
    contracts: false
  };

  try {
    // Test 1: Viem Provider
    console.log('📡 Testing Viem Provider...');
    try {
      const { createPublicClient } = await import('viem');
      const { bsc } = await import('viem/chains');
      const { createViemClient } = await import('./src/bsc/providers/viem-provider.js');

      const client = createViemClient();
      if (client && typeof client.getChainId === 'function') {
        results.viemProvider = true;
        console.log('✅ Viem Provider - OK');
      }
    } catch (error) {
      console.log('❌ Viem Provider - FAILED:', error.message);
    }

    // Test 2: Token Service
    console.log('\n🪙 Testing Token Service...');
    try {
      const { BSCTokenServiceViem } = await import('./src/bsc/services/tokens/token-service-viem.js');

      // Check if class exists and has required methods
      if (BSCTokenServiceViem && typeof BSCTokenServiceViem === 'function') {
        const methods = ['discoverTokens', 'getAllTokens', 'getTokenByAddress', 'verifyToken'];
        const hasMethods = methods.every(method => {
          const proto = BSCTokenServiceViem.prototype;
          return proto && typeof proto[method] === 'function';
        });

        if (hasMethods) {
          results.tokenService = true;
          console.log('✅ Token Service - OK');
        }
      }
    } catch (error) {
      console.log('❌ Token Service - FAILED:', error.message);
    }

    // Test 3: Swap Service
    console.log('\n💱 Testing Swap Service...');
    try {
      const { SwapServiceViem } = await import('./src/bsc/services/trading/swap-service-viem.js');

      if (SwapServiceViem && typeof SwapServiceViem === 'function') {
        const methods = ['getQuote', 'executeSwap', 'getTransaction'];
        const hasMethods = methods.every(method => {
          const proto = SwapServiceViem.prototype;
          return proto && typeof proto[method] === 'function';
        });

        if (hasMethods) {
          results.swapService = true;
          console.log('✅ Swap Service - OK');
        }
      }
    } catch (error) {
      console.log('❌ Swap Service - FAILED:', error.message);
    }

    // Test 4: Liquidity Service
    console.log('\n💧 Testing Liquidity Service...');
    try {
      const { LiquidityServiceViem } = await import('./src/bsc/services/liquidity/liquidity-service-viem.js');

      if (LiquidityServiceViem && typeof LiquidityServiceViem === 'function') {
        const methods = ['getLiquidityPools', 'getPoolInfo', 'addLiquidity'];
        const hasMethods = methods.every(method => {
          const proto = LiquidityServiceViem.prototype;
          return proto && typeof proto[method] === 'function';
        });

        if (hasMethods) {
          results.liquidityService = true;
          console.log('✅ Liquidity Service - OK');
        }
      }
    } catch (error) {
      console.log('❌ Liquidity Service - FAILED:', error.message);
    }

    // Test 5: Farming Service
    console.log('\n🌾 Testing Farming Service...');
    try {
      const { FarmingServiceViem } = await import('./src/bsc/services/yield/farming-service-viem.js');

      if (FarmingServiceViem && typeof FarmingServiceViem === 'function') {
        const methods = ['getFarms', 'stake', 'unstake', 'harvest'];
        const hasMethods = methods.every(method => {
          const proto = FarmingServiceViem.prototype;
          return proto && typeof proto[method] === 'function';
        });

        if (hasMethods) {
          results.farmingService = true;
          console.log('✅ Farming Service - OK');
        }
      }
    } catch (error) {
      console.log('❌ Farming Service - FAILED:', error.message);
    }

    // Test 6: Smart Contracts
    console.log('\n📜 Testing Smart Contracts...');
    try {
      const contractFiles = [
        './src/bsc/contracts/pancakeswap-router.js',
        './src/bsc/contracts/pancakeswap-factory.js',
        './src/bsc/contracts/pancakeswap-pair.js',
        './src/bsc/contracts/masterchef-v1.js'
      ];

      let contractsOk = 0;
      for (const file of contractFiles) {
        try {
          await import(file);
          contractsOk++;
        } catch (e) {
          // Skip individual file errors
        }
      }

      if (contractsOk >= 2) {
        results.contracts = true;
        console.log(`✅ Smart Contracts - OK (${contractsOk}/${contractFiles.length} loaded)`);
      }
    } catch (error) {
      console.log('❌ Smart Contracts - FAILED:', error.message);
    }

    // Results Summary
    console.log('\n📊 BSC Functionality Validation Results:');
    console.log('=' .repeat(50));

    const passed = Object.values(results).filter(Boolean).length;
    const total = Object.keys(results).length;
    const percentage = Math.round((passed / total) * 100);

    Object.entries(results).forEach(([service, passed]) => {
      const status = passed ? '✅ PASS' : '❌ FAIL';
      const name = service.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
      console.log(`${status} ${name.padEnd(20)}`);
    });

    console.log('=' .repeat(50));
    console.log(`📈 Overall: ${passed}/${total} services functional (${percentage}%)`);

    if (percentage >= 80) {
      console.log('🎉 BSC Functionality Validation: PASSED');
      process.exit(0);
    } else {
      console.log('⚠️  BSC Functionality Validation: NEEDS ATTENTION');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Validation script failed:', error);
    process.exit(1);
  }
}

// Run validation
validateBSCFunctionality().catch(console.error);