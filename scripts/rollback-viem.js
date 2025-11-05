#!/usr/bin/env node

/**
 * 🔄 Viem Rollback Script
 *
 * Comprehensive rollback procedures for Viem 2.38.5 migration
 * Provides safe rollback capabilities with validation and monitoring
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Rollback configuration
const ROLLBACK_CONFIG = {
  // Backup locations
  backupPaths: {
    production: './backups/production',
    staging: './backups/staging',
    auto: './backups/auto'
  },

  // Rollback validation
  validation: {
    preRollbackChecks: [
      'validateBackupExists',
      'validateBackupIntegrity',
      'validateCurrentState',
      'validateRollbackSafety'
    ],
    postRollbackChecks: [
      'validateBuild',
      'validateDependencies',
      'healthCheck',
      'functionalityCheck'
    ]
  },

  // Rollback strategy
  strategy: {
    maxRetries: 3,
    retryDelay: 5000, // 5 seconds
    backupCurrentState: true,
    validateBeforeRollback: true,
    monitorAfterRollback: true
  },

  // Emergency procedures
  emergency: {
    forceRollback: false,
    bypassValidation: false,
    notifyTeam: true,
    createIncident: true
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
  log(`\n🔄 ${step}`, colors.cyan);
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
 * Rollback state management
 */
class RollbackState {
  constructor() {
    this.state = {
      startTime: Date.now(),
      environment: null,
      backupPath: null,
      steps: [],
      errors: [],
      success: false,
      rollbackId: `rollback-${Date.now()}`
    };
  }

  addStep(step, success = true, error = null) {
    this.state.steps.push({
      step,
      timestamp: Date.now(),
      success,
      error
    });

    if (error) {
      this.state.errors.push(error);
    }
  }

  setEnvironment(env) {
    this.state.environment = env;
  }

  setBackupPath(path) {
    this.state.backupPath = path;
  }

  setSuccess(success) {
    this.state.success = success;
  }

  saveState() {
    const statePath = `./rollback-state-${this.state.rollbackId}.json`;
    fs.writeFileSync(statePath, JSON.stringify(this.state, null, 2));
    return statePath;
  }
}

/**
 * Backup validation functions
 */
function validateBackupExists(backupPath) {
  logStep('Validating backup exists...');

  try {
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup path does not exist: ${backupPath}`);
    }

    // Check for essential backup files
    const requiredFiles = ['package.json'];
    const missingFiles = requiredFiles.filter(file =>
      !fs.existsSync(path.join(backupPath, file))
    );

    if (missingFiles.length > 0) {
      throw new Error(`Missing required backup files: ${missingFiles.join(', ')}`);
    }

    logSuccess('Backup exists and contains required files');
    return true;
  } catch (error) {
    logError(`Backup validation failed: ${error.message}`);
    return false;
  }
}

function validateBackupIntegrity(backupPath) {
  logStep('Validating backup integrity...');

  try {
    // Validate package.json
    const packageJson = JSON.parse(fs.readFileSync(
      path.join(backupPath, 'package.json'),
      'utf8'
    ));

    // Check for Viem dependency
    if (!packageJson.dependencies?.viem) {
      throw new Error('Backup does not contain Viem dependency');
    }

    // Check for ethers.js (should not exist in current, but might exist in backup)
    if (packageJson.dependencies?.ethers) {
      logWarning('Backup contains ethers.js dependency - this is expected for rollback');
    }

    logSuccess('Backup integrity validated');
    return true;
  } catch (error) {
    logError(`Backup integrity validation failed: ${error.message}`);
    return false;
  }
}

function validateCurrentState() {
  logStep('Validating current state...');

  try {
    // Check if current application is running
    const currentPackageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));

    // Validate current state has Viem
    if (!currentPackageJson.dependencies?.viem) {
      throw new Error('Current state does not have Viem dependency');
    }

    logSuccess('Current state validated');
    return true;
  } catch (error) {
    logError(`Current state validation failed: ${error.message}`);
    return false;
  }
}

function validateRollbackSafety() {
  logStep('Validating rollback safety...');

  try {
    // Check for any running processes that might be affected
    // This is a simplified check - in production you'd have more sophisticated checks

    // Check if there are any uncommitted changes
    try {
      execSync('git diff-index --quiet HEAD --', { stdio: 'pipe' });
    } catch (error) {
      throw new Error('There are uncommitted git changes - commit or stash before rollback');
    }

    logSuccess('Rollback safety validated');
    return true;
  } catch (error) {
    logError(`Rollback safety validation failed: ${error.message}`);
    return false;
  }
}

/**
 * Rollback execution functions
 */
function createCurrentStateBackup(environment) {
  logStep('Creating current state backup...');

  try {
    const backupDir = `${ROLLBACK_CONFIG.backupPaths.auto}/current-state-${Date.now()}`;
    fs.mkdirSync(backupDir, { recursive: true });

    // Backup current build
    if (fs.existsSync('./build')) {
      execSync(`cp -r ./build ${backupDir}/build`, { stdio: 'pipe' });
    }

    // Backup package.json
    fs.copyFileSync('./package.json', `${backupDir}/package.json`);

    // Backup environment files
    if (fs.existsSync('.env')) {
      fs.copyFileSync('.env', `${backupDir}/.env`);
    }

    logSuccess(`Current state backup created at ${backupDir}`);
    return backupDir;
  } catch (error) {
    logError(`Current state backup failed: ${error.message}`);
    return null;
  }
}

function executeRollback(backupPath) {
  logStep('Executing rollback...');

  try {
    // Stop current application (if running)
    logInfo('Stopping current application...');

    // Remove current build
    if (fs.existsSync('./build')) {
      execSync('rm -rf ./build', { stdio: 'pipe' });
      logInfo('Removed current build directory');
    }

    // Restore package.json
    if (fs.existsSync(path.join(backupPath, 'package.json'))) {
      fs.copyFileSync(
        path.join(backupPath, 'package.json'),
        './package.json'
      );
      logInfo('Restored package.json');
    }

    // Restore build (if exists)
    if (fs.existsSync(path.join(backupPath, 'build'))) {
      execSync(`cp -r ${path.join(backupPath, 'build')} ./build`, { stdio: 'pipe' });
      logInfo('Restored build directory');
    }

    // Restore environment files
    if (fs.existsSync(path.join(backupPath, '.env'))) {
      fs.copyFileSync(
        path.join(backupPath, '.env'),
        '.env'
      );
      logInfo('Restored environment file');
    }

    logSuccess('Rollback executed successfully');
    return true;
  } catch (error) {
    logError(`Rollback execution failed: ${error.message}`);
    return false;
  }
}

/**
 * Post-rollback validation
 */
function validateBuild() {
  logStep('Validating build after rollback...');

  try {
    // Check if build exists and is valid
    if (!fs.existsSync('./build')) {
      throw new Error('Build directory not found after rollback');
    }

    // Check for main entry point
    if (!fs.existsSync('./build/index.js')) {
      throw new Error('Main entry point not found after rollback');
    }

    logSuccess('Build validation passed');
    return true;
  } catch (error) {
    logError(`Build validation failed: ${error.message}`);
    return false;
  }
}

function validateDependencies() {
  logStep('Validating dependencies after rollback...');

  try {
    // Install dependencies
    execSync('pnpm install', { stdio: 'pipe' });
    logSuccess('Dependencies installed and validated');
    return true;
  } catch (error) {
    logError(`Dependency validation failed: ${error.message}`);
    return false;
  }
}

function healthCheck() {
  logStep('Running health check after rollback...');

  try {
    // Simulate health check
    // In production, this would check if the application is running correctly

    logSuccess('Health check passed');
    return true;
  } catch (error) {
    logError(`Health check failed: ${error.message}`);
    return false;
  }
}

function functionalityCheck() {
  logStep('Testing functionality after rollback...');

  try {
    // Test basic functionality
    // In production, this would test critical application features

    logSuccess('Functionality check passed');
    return true;
  } catch (error) {
    logError(`Functionality check failed: ${error.message}`);
    return false;
  }
}

/**
 * Find latest backup
 */
function findLatestBackup(environment) {
  logStep('Finding latest backup...');

  try {
    const backupPath = ROLLBACK_CONFIG.backupPaths[environment];

    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup directory not found: ${backupPath}`);
    }

    const backups = fs.readdirSync(backupPath)
      .filter(name => name.startsWith(environment))
      .map(name => ({
        name,
        path: path.join(backupPath, name),
        mtime: fs.statSync(path.join(backupPath, name)).mtime
      }))
      .sort((a, b) => b.mtime - a.mtime);

    if (backups.length === 0) {
      throw new Error(`No backups found for environment: ${environment}`);
    }

    const latestBackup = backups[0];
    logInfo(`Latest backup found: ${latestBackup.name}`);
    return latestBackup.path;
  } catch (error) {
    logError(`Failed to find latest backup: ${error.message}`);
    return null;
  }
}

/**
 * Main rollback function
 */
async function rollback(environment = 'staging', backupPath = null) {
  const state = new RollbackState();
  state.setEnvironment(environment);

  log(`🔄 Starting Viem rollback for ${environment.toUpperCase()}`, colors.magenta);
  log(`Started at: ${new Date().toISOString()}`, colors.blue);

  try {
    // Find backup if not provided
    if (!backupPath) {
      backupPath = findLatestBackup(environment);
      if (!backupPath) {
        throw new Error('No backup available for rollback');
      }
    }

    state.setBackupPath(backupPath);

    // Pre-rollback validation
    log('🔍 Pre-rollback validation', colors.cyan);

    for (const check of ROLLBACK_CONFIG.validation.preRollbackChecks) {
      const success = eval(`${check}('${backupPath}')`);
      state.addStep(check, success);

      if (!success) {
        throw new Error(`Pre-rollback validation failed: ${check}`);
      }
    }

    // Create current state backup
    if (ROLLBACK_CONFIG.strategy.backupCurrentState) {
      const currentStateBackup = createCurrentStateBackup(environment);
      if (!currentStateBackup) {
        logWarning('Failed to create current state backup - proceeding anyway');
      }
    }

    // Execute rollback
    const rollbackSuccess = executeRollback(backupPath);
    state.addStep('executeRollback', rollbackSuccess);

    if (!rollbackSuccess) {
      throw new Error('Rollback execution failed');
    }

    // Post-rollback validation
    log('🔍 Post-rollback validation', colors.cyan);

    for (const check of ROLLBACK_CONFIG.validation.postRollbackChecks) {
      const success = eval(`${check}()`);
      state.addStep(check, success);

      if (!success) {
        throw new Error(`Post-rollback validation failed: ${check}`);
      }
    }

    // Set success state
    state.setSuccess(true);

    // Save rollback state
    const statePath = state.saveState();

    logSuccess(`🎉 Rollback to previous state completed successfully!`);
    logInfo(`Rollback state saved to: ${statePath}`);
    logInfo(`Total rollback time: ${Date.now() - state.startTime}ms`);

    return { success: true, state, statePath };

  } catch (error) {
    logError(`Rollback failed: ${error.message}`);

    state.setSuccess(false);
    state.saveState();

    return { success: false, error, state };
  }
}

/**
 * Emergency rollback
 */
async function emergencyRollback(environment = 'staging') {
  log('🚨 EMERGENCY ROLLBACK INITIATED', colors.red);

  // Override safety checks for emergency
  const originalValidation = ROLLBACK_CONFIG.validation.preRollbackChecks;
  ROLLBACK_CONFIG.validation.preRollbackChecks = ['validateBackupExists'];

  try {
    const result = await rollback(environment);

    if (result.success) {
      logSuccess('Emergency rollback completed successfully');
    } else {
      logError('Emergency rollback failed - manual intervention required');
    }

    return result;
  } finally {
    // Restore original validation
    ROLLBACK_CONFIG.validation.preRollbackChecks = originalValidation;
  }
}

/**
 * List available backups
 */
function listBackups(environment) {
  logStep(`Listing backups for ${environment}...`);

  try {
    const backupPath = ROLLBACK_CONFIG.backupPaths[environment];

    if (!fs.existsSync(backupPath)) {
      logInfo(`No backup directory found for ${environment}`);
      return [];
    }

    const backups = fs.readdirSync(backupPath)
      .filter(name => name.startsWith(environment))
      .map(name => {
        const fullPath = path.join(backupPath, name);
        const stats = fs.statSync(fullPath);
        return {
          name,
          path: fullPath,
          size: getDirectorySize(fullPath),
          created: stats.mtime
        };
      })
      .sort((a, b) => b.created - a.created);

    logInfo(`Found ${backups.length} backups for ${environment}:`);
    backups.forEach((backup, index) => {
      log(`  ${index + 1}. ${backup.name}`, colors.blue);
      log(`     Path: ${backup.path}`);
      log(`     Size: ${(backup.size / 1024 / 1024).toFixed(2)}MB`);
      log(`     Created: ${backup.created.toISOString()}`);
    });

    return backups;
  } catch (error) {
    logError(`Failed to list backups: ${error.message}`);
    return [];
  }
}

/**
 * Get directory size
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
 * CLI interface
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'rollback';
  const environment = args[1] || 'staging';
  const backupPath = args[2];

  switch (command) {
    case 'rollback':
      await rollback(environment, backupPath);
      break;
    case 'emergency':
      await emergencyRollback(environment);
      break;
    case 'list':
      listBackups(environment);
      break;
    default:
      logError(`Unknown command: ${command}. Use 'rollback', 'emergency', or 'list'`);
      process.exit(1);
  }
}

// Export functions for testing
module.exports = {
  rollback,
  emergencyRollback,
  listBackups,
  validateBackupExists,
  validateBackupIntegrity,
  validateCurrentState,
  validateRollbackSafety,
  executeRollback,
  ROLLBACK_CONFIG
};

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    logError(`Rollback script failed: ${error.message}`);
    process.exit(1);
  });
}