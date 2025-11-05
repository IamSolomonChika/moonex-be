/**
 * 🚀 Viem Build Configuration
 *
 * Enhanced build configuration optimized for Viem 2.38.5 migration
 * Provides build optimization, validation, and monitoring capabilities
 */

const path = require('path');
const fs = require('fs');

// Viem-specific build configuration
const VIEM_BUILD_CONFIG = {
  // Build optimization settings
  optimization: {
    // TypeScript compilation with Viem-specific settings
    typescript: {
      target: 'ES2022',
      module: 'CommonJS',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      incremental: true,
      tsBuildInfoFile: './build/.tsbuildinfo'
    },

    // Bundle analysis settings
    bundleAnalysis: {
      enabled: true,
      outputPath: './build/reports',
      maxSizeThreshold: '5MB', // Alert if bundle exceeds 5MB
      compressionThreshold: '2MB' // Alert if gzipped bundle exceeds 2MB
    },

    // Dependency validation
    dependencies: {
      required: ['viem@2.38.5'],
      prohibited: ['ethers'], // Ensure no ethers.js dependencies
      warnOnUnresolved: true
    }
  },

  // Environment-specific configurations
  environments: {
    development: {
      sourceMap: true,
      minify: false,
      treeshaking: false,
      profiling: true
    },
    staging: {
      sourceMap: true,
      minify: true,
      treeshaking: true,
      profiling: false
    },
    production: {
      sourceMap: false,
      minify: true,
      treeshaking: true,
      profiling: false
    }
  },

  // Viem-specific validation
  viemValidation: {
    // Check for Viem-specific patterns
    patterns: {
      // Ensure Viem imports are used correctly
      viemImports: [
        'from "viem"',
        'from "viem/chains"',
        'from "viem/accounts"',
        'from "viem/contract"'
      ],

      // Deprecated patterns to avoid
      deprecatedPatterns: [
        'ethers.providers',
        'ethers.Contract',
        'ethers.Wallet',
        'BigNumber.from('
      ],

      // Required Viem configurations
      requiredConfigs: [
        'BSC_RPC_URL',
        'BSC_CHAIN_ID',
        'PANCAKESWAP_ROUTER_V2'
      ]
    },

    // Performance benchmarks
    benchmarks: {
      maxBuildTime: 60000, // 60 seconds max build time
      maxBundleSize: 5242880, // 5MB max bundle size
      maxDependencies: 200, // Max number of dependencies
      maxCircularDeps: 0 // No circular dependencies allowed
    }
  },

  // Monitoring and reporting
  monitoring: {
    // Build metrics to track
    metrics: [
      'buildDuration',
      'bundleSize',
      'dependencyCount',
      'typescriptErrors',
      'viamValidationResults'
    ],

    // Alert thresholds
    alerts: {
      buildDuration: 120000, // Alert if build takes > 2 minutes
      bundleSize: 10485760, // Alert if bundle > 10MB
      typescriptErrors: 0, // Any TypeScript errors should alert
      viemValidationFailures: 0 // Any Viem validation failures should alert
    }
  }
};

/**
 * Validates Viem-specific build requirements
 */
function validateViemBuild() {
  console.log('🔍 Validating Viem build requirements...');

  const issues = [];

  // Check package.json for Viem dependencies
  try {
    const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
    const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

    // Validate required Viem dependency
    if (!dependencies['viem']) {
      issues.push('❌ Viem dependency not found in package.json');
    } else if (dependencies['viem'] !== '2.38.5') {
      issues.push(`⚠️  Viem version mismatch. Expected 2.38.5, found ${dependencies['viem']}`);
    }

    // Check for prohibited ethers.js dependency
    if (dependencies['ethers']) {
      issues.push('❌ Ethers.js dependency found - should be removed after Viem migration');
    }

    // Validate BSC-specific dependencies
    const requiredDeps = ['@privy-io/server-auth', 'fastify', '@prisma/client'];
    requiredDeps.forEach(dep => {
      if (!dependencies[dep]) {
        issues.push(`❌ Required dependency ${dep} not found`);
      }
    });

  } catch (error) {
    issues.push('❌ Failed to read package.json');
  }

  // Check TypeScript configuration
  try {
    const tsConfig = JSON.parse(fs.readFileSync('./tsconfig.json', 'utf8'));

    if (!tsConfig.compilerOptions.strict) {
      issues.push('⚠️  TypeScript strict mode not enabled - recommended for Viem');
    }

    if (tsConfig.compilerOptions.target !== 'ES2022') {
      issues.push('⚠️  TypeScript target should be ES2022 for optimal Viem performance');
    }

  } catch (error) {
    issues.push('❌ Failed to read tsconfig.json');
  }

  // Check for Viem configuration files
  const viemFiles = [
    './src/config/bsc.ts',
    './src/services/token-service.ts',
    './src/services/swap-service.ts'
  ];

  viemFiles.forEach(file => {
    if (!fs.existsSync(file)) {
      issues.push(`⚠️  Viem integration file not found: ${file}`);
    }
  });

  if (issues.length > 0) {
    console.log('\n❌ Viem Build Validation Issues:');
    issues.forEach(issue => console.log(issue));
    return false;
  } else {
    console.log('✅ Viem build validation passed');
    return true;
  }
}

/**
 * Generates build report
 */
function generateBuildReport(startTime, endTime) {
  const buildDuration = endTime - startTime;
  const buildSize = getDirectorySize('./build');

  const report = {
    timestamp: new Date().toISOString(),
    duration: buildDuration,
    bundleSize: buildSize,
    viemVersion: '2.38.5',
    environment: process.env.NODE_ENV || 'development',
    validation: validateViemBuild()
  };

  // Save build report
  const reportPath = './build/build-report.json';
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log('\n📊 Build Report Generated:');
  console.log(`   Duration: ${buildDuration}ms`);
  console.log(`   Bundle Size: ${(buildSize / 1024 / 1024).toFixed(2)}MB`);
  console.log(`   Environment: ${report.environment}`);
  console.log(`   Viem Version: ${report.viemVersion}`);
  console.log(`   Validation: ${report.validation ? '✅ Passed' : '❌ Failed'}`);
  console.log(`   Report saved to: ${reportPath}`);

  return report;
}

/**
 * Gets directory size in bytes
 */
function getDirectorySize(dirPath) {
  try {
    let totalSize = 0;
    const files = fs.readdirSync(dirPath);

    files.forEach(file => {
      const filePath = path.join(dirPath, file);
      const stats = fs.statSync(filePath);

      if (stats.isDirectory()) {
        totalSize += getDirectorySize(filePath);
      } else {
        totalSize += stats.size;
      }
    });

    return totalSize;
  } catch (error) {
    return 0;
  }
}

/**
 * Main build function
 */
function buildViemProject() {
  const startTime = Date.now();

  console.log('🚀 Starting Viem-optimized build...\n');

  // Validate build requirements
  if (!validateViemBuild()) {
    console.log('\n❌ Build validation failed. Fix issues before proceeding.');
    process.exit(1);
  }

  // Run TypeScript compilation
  console.log('🔨 Compiling TypeScript...');
  try {
    const { execSync } = require('child_process');
    execSync('npx tsc', { stdio: 'inherit' });
    console.log('✅ TypeScript compilation successful');
  } catch (error) {
    console.log('❌ TypeScript compilation failed');
    process.exit(1);
  }

  // Run Prisma generation
  console.log('🗄️  Generating Prisma client...');
  try {
    const { execSync } = require('child_process');
    execSync('npx prisma generate', { stdio: 'inherit' });
    console.log('✅ Prisma client generated');
  } catch (error) {
    console.log('❌ Prisma generation failed');
    process.exit(1);
  }

  const endTime = Date.now();

  // Generate build report
  const report = generateBuildReport(startTime, endTime);

  console.log('\n✅ Viem build completed successfully!');
  return report;
}

// Export for use in scripts
module.exports = {
  VIEM_BUILD_CONFIG,
  validateViemBuild,
  generateBuildReport,
  buildViemProject
};

// Run build if called directly
if (require.main === module) {
  buildViemProject();
}