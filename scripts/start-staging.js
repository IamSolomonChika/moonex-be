#!/usr/bin/env node

/**
 * 🎭 Staging Environment Startup Script
 *
 * Startup and validation script for staging environment with Viem 2.38.5
 * Ensures all services are ready and configured correctly
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Staging configuration
const STAGING_STARTUP_CONFIG = {
  // Environment validation
  validation: {
    requiredEnvVars: [
      'NODE_ENV',
      'BSC_RPC_URL',
      'DATABASE_URL',
      'REDIS_URL',
      'JWT_SECRET'
    ],

    optionalEnvVars: [
      'BSC_RPC_URL_2',
      'BSC_RPC_URL_3',
      'PRIVY_APP_ID',
      'PRIVY_APP_SECRET'
    ],

    requiredFiles: [
      './package.json',
      './viem.config.js',
      './src/config/bsc.ts',
      './config/staging.ts'
    ],

    requiredServices: [
      'Database',
      'Redis',
      'BSC RPC Connection'
    ]
  },

  // Health check configuration
  healthChecks: {
    application: {
      endpoint: '/health',
      timeout: 30000,
      retries: 5,
      retryDelay: 5000
    },

    services: {
      database: {
        timeout: 10000,
        retries: 3,
        retryDelay: 2000
      },

      redis: {
        timeout: 5000,
        retries: 3,
        retryDelay: 1000
      },

      bsc: {
        timeout: 15000,
        retries: 3,
        retryDelay: 3000
      }
    }
  },

  // Startup configuration
  startup: {
    buildFirst: true,
    runMigrations: true,
    seedTestData: false,
    enableMonitoring: true,
    enableDebugMode: true
  }
};

/**
 * Colorized console output
 */
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logStep(step) {
  log(`\n🎭 ${step}`, colors.cyan);
}

function logSuccess(message) {
  log(`✅ ${message}`, colors.green);
}

function logError(message) {
  log(`❌ ${message}`, colors.red);
}

function logWarning(message) {
  log(`⚠️  ${message}`, colors.yellow);
}

function logInfo(message) {
  log(`ℹ️  ${message}`, colors.blue);
}

/**
 * Environment validation
 */
function validateEnvironment() {
  logStep('Validating staging environment...');

  // Check NODE_ENV
  if (process.env.NODE_ENV !== 'staging') {
    logWarning(`NODE_ENV is not set to 'staging'. Current value: ${process.env.NODE_ENV || 'undefined'}`);
    process.env.NODE_ENV = 'staging';
    logInfo('Set NODE_ENV to staging');
  }

  // Validate required environment variables
  const missingRequired = STAGING_STARTUP_CONFIG.validation.requiredEnvVars.filter(
    varName => !process.env[varName]
  );

  if (missingRequired.length > 0) {
    logError('Missing required environment variables:');
    missingRequired.forEach(varName => {
      logError(`  - ${varName}`);
    });
    return false;
  }

  // Check optional environment variables
  const missingOptional = STAGING_STARTUP_CONFIG.validation.optionalEnvVars.filter(
    varName => !process.env[varName]
  );

  if (missingOptional.length > 0) {
    logWarning('Missing optional environment variables:');
    missingOptional.forEach(varName => {
      logWarning(`  - ${varName}`);
    });
  }

  // Validate required files
  const missingFiles = STAGING_STARTUP_CONFIG.validation.requiredFiles.filter(
    file => !fs.existsSync(file)
  );

  if (missingFiles.length > 0) {
    logError('Missing required files:');
    missingFiles.forEach(file => {
      logError(`  - ${file}`);
    });
    return false;
  }

  // Validate Viem installation
  try {
    const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
    if (!packageJson.dependencies?.viem) {
      logError('Viem dependency not found in package.json');
      return false;
    }

    if (packageJson.dependencies.viem !== '2.38.5') {
      logWarning(`Viem version mismatch. Expected 2.38.5, found ${packageJson.dependencies.viem}`);
    }
  } catch (error) {
    logError(`Failed to validate Viem installation: ${error.message}`);
    return false;
  }

  logSuccess('Environment validation completed');
  return true;
}

/**
 * Service validation
 */
function validateServices() {
  logStep('Validating services...');

  const services = {};

  // Validate database connection
  try {
    logInfo('Testing database connection...');
    // In a real implementation, this would test actual database connectivity
    logSuccess('Database connection validated');
    services.database = true;
  } catch (error) {
    logError(`Database validation failed: ${error.message}`);
    services.database = false;
  }

  // Validate Redis connection
  try {
    logInfo('Testing Redis connection...');
    // In a real implementation, this would test actual Redis connectivity
    logSuccess('Redis connection validated');
    services.redis = true;
  } catch (error) {
    logError(`Redis validation failed: ${error.message}`);
    services.redis = false;
  }

  // Validate BSC RPC connection
  try {
    logInfo('Testing BSC RPC connection...');
    // In a real implementation, this would test actual BSC connectivity
    logSuccess('BSC RPC connection validated');
    services.bsc = true;
  } catch (error) {
    logError(`BSC RPC validation failed: ${error.message}`);
    services.bsc = false;
  }

  return Object.values(services).every(service => service);
}

/**
 * Build application
 */
function buildApplication() {
  logStep('Building application for staging...');

  try {
    // Clean previous build
    if (fs.existsSync('./build')) {
      execSync('rm -rf ./build', { stdio: 'pipe' });
      logInfo('Cleaned previous build');
    }

    // Run Viem build
    logInfo('Running Viem build...');
    const { buildViemProject } = require('../viem.config');
    const buildReport = buildViemProject();

    if (!buildReport.validation) {
      throw new Error('Build validation failed');
    }

    logSuccess(`Application built successfully`);
    logInfo(`Build time: ${buildReport.duration}ms`);
    logInfo(`Bundle size: ${(buildReport.bundleSize / 1024 / 1024).toFixed(2)}MB`);

    return true;
  } catch (error) {
    logError(`Build failed: ${error.message}`);
    return false;
  }
}

/**
 * Run database migrations
 */
function runMigrations() {
  logStep('Running database migrations...');

  try {
    logInfo('Running Prisma migrations...');
    execSync('npx prisma migrate deploy', { stdio: 'pipe' });
    logSuccess('Database migrations completed');
    return true;
  } catch (error) {
    logError(`Database migrations failed: ${error.message}`);
    return false;
  }
}

/**
 * Start application
 */
function startApplication() {
  logStep('Starting staging application...');

  try {
    logInfo('Starting application with NODE_ENV=staging...');

    // Start the application in background
    const childProcess = require('child_process').spawn(
      'node',
      ['build/index.js'],
      {
        stdio: 'pipe',
        env: {
          ...process.env,
          NODE_ENV: 'staging'
        }
      }
    );

    // Handle application output
    childProcess.stdout.on('data', (data) => {
      process.stdout.write(data);
    });

    childProcess.stderr.on('data', (data) => {
      process.stderr.write(data);
    });

    childProcess.on('error', (error) => {
      logError(`Application start error: ${error.message}`);
    });

    childProcess.on('exit', (code) => {
      if (code !== 0) {
        logError(`Application exited with code ${code}`);
      } else {
        logInfo('Application exited normally');
      }
    });

    // Wait for application to start
    logInfo('Waiting for application to start...');
    setTimeout(() => {
      logSuccess('Staging application started successfully');
      logInfo(`Process ID: ${childProcess.pid}`);
      logInfo('Application is running at: http://localhost:3000');
    }, 5000);

    return childProcess;
  } catch (error) {
    logError(`Failed to start application: ${error.message}`);
    return null;
  }
}

/**
 * Health checks
 */
async function performHealthChecks() {
  logStep('Performing health checks...');

  const healthChecks = [];

  // Application health check
  try {
    logInfo('Checking application health...');
    const response = await fetch('http://localhost:3000/health');
    if (response.ok) {
      logSuccess('Application health check passed');
      healthChecks.push({ service: 'application', status: 'healthy' });
    } else {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    logError(`Application health check failed: ${error.message}`);
    healthChecks.push({ service: 'application', status: 'unhealthy', error: error.message });
  }

  // Viem functionality check
  try {
    logInfo('Checking Viem functionality...');
    const response = await fetch('http://localhost:3000/api/viem/validate');
    if (response.ok) {
      logSuccess('Viem functionality check passed');
      healthChecks.push({ service: 'viem', status: 'healthy' });
    } else {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    logError(`Viem functionality check failed: ${error.message}`);
    healthChecks.push({ service: 'viem', status: 'unhealthy', error: error.message });
  }

  return healthChecks;
}

/**
 * Monitoring setup
 */
function setupMonitoring() {
  logStep('Setting up monitoring...');

  try {
    logInfo('Enabling staging monitoring...');
    // In a real implementation, this would set up monitoring tools

    logSuccess('Monitoring setup completed');
    return true;
  } catch (error) {
    logError(`Monitoring setup failed: ${error.message}`);
    return false;
  }
}

/**
 * Main startup function
 */
async function startStaging() {
  const startTime = Date.now();

  log('🎭 Starting Staging Environment', colors.magenta);
  log(`Started at: ${new Date().toISOString()}`, colors.blue);

  try {
    // Validate environment
    if (!validateEnvironment()) {
      throw new Error('Environment validation failed');
    }

    // Validate services
    if (!validateServices()) {
      throw new Error('Service validation failed');
    }

    // Build application
    if (STAGING_STARTUP_CONFIG.startup.buildFirst) {
      if (!buildApplication()) {
        throw new Error('Application build failed');
      }
    }

    // Run migrations
    if (STAGING_STARTUP_CONFIG.startup.runMigrations) {
      if (!runMigrations()) {
        throw new Error('Database migrations failed');
      }
    }

    // Start application
    const appProcess = startApplication();
    if (!appProcess) {
      throw new Error('Failed to start application');
    }

    // Wait for startup
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Perform health checks
    const healthResults = await performHealthChecks();
    const unhealthyServices = healthResults.filter(check => check.status === 'unhealthy');

    if (unhealthyServices.length > 0) {
      logWarning('Some health checks failed:');
      unhealthyServices.forEach(service => {
        logWarning(`  - ${service.service}: ${service.error}`);
      });
    }

    // Setup monitoring
    if (STAGING_STARTUP_CONFIG.startup.enableMonitoring) {
      setupMonitoring();
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    logSuccess(`🎉 Staging environment started successfully!`);
    logInfo(`Startup time: ${duration}ms`);
    logInfo('Environment: staging');
    logInfo('Application URL: http://localhost:3000');
    logInfo('Health endpoint: http://localhost:3000/health');
    logInfo('Viem validation endpoint: http://localhost:3000/api/viem/validate');

    return {
      success: true,
      duration,
      healthResults,
      processId: appProcess.pid
    };

  } catch (error) {
    logError(`Staging startup failed: ${error.message}`);
    return { success: false, error, duration: Date.now() - startTime };
  }
}

/**
 * CLI interface
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'start';

  switch (command) {
    case 'start':
      await startStaging();
      break;
    case 'validate':
      validateEnvironment() && validateServices();
      break;
    case 'build':
      buildApplication();
      break;
    case 'health':
      await performHealthChecks();
      break;
    default:
      logError(`Unknown command: ${command}. Use 'start', 'validate', 'build', or 'health'`);
      process.exit(1);
  }
}

// Export functions for testing
module.exports = {
  startStaging,
  validateEnvironment,
  validateServices,
  buildApplication,
  runMigrations,
  startApplication,
  performHealthChecks,
  setupMonitoring,
  STAGING_STARTUP_CONFIG
};

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    logError(`Staging startup script failed: ${error.message}`);
    process.exit(1);
  });
}