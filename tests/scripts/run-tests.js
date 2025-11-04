#!/usr/bin/env node

/**
 * Test Runner Script for BSC Testing Infrastructure
 * Provides comprehensive test execution with reporting and coverage
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const TEST_CONFIG = {
  // Test categories
  categories: {
    unit: {
      pattern: 'tests/unit/**/*.test.ts',
      description: 'Unit Tests - Individual service testing',
      timeout: 30000
    },
    integration: {
      pattern: 'tests/integration/**/*.test.ts',
      description: 'Integration Tests - Multi-service testing',
      timeout: 60000
    },
    e2e: {
      pattern: 'tests/e2e/**/*.test.ts',
      description: 'End-to-End Tests - Complete workflow testing',
      timeout: 120000
    }
  },

  // Test environments
  environments: ['test', 'development'],

  // Coverage settings
  coverage: {
    enabled: true,
    reporters: ['text', 'lcov', 'html'],
    outputDir: 'coverage',
    thresholds: {
      lines: 80,
      functions: 80,
      branches: 75,
      statements: 80
    }
  }
};

class TestRunner {
  constructor() {
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0,
      categories: {}
    };
  }

  /**
   * Run all tests or specific categories
   */
  async runTests(categories = Object.keys(TEST_CONFIG.categories), options = {}) {
    console.log('🚀 Starting BSC Testing Infrastructure Test Runner\n');

    const startTime = Date.now();

    try {
      // Setup test environment
      await this.setupTestEnvironment();

      // Run tests by category
      for (const category of categories) {
        if (!TEST_CONFIG.categories[category]) {
          console.log(`❌ Unknown test category: ${category}`);
          continue;
        }

        console.log(`\n📋 Running ${TEST_CONFIG.categories[category].description}...`);
        await this.runTestCategory(category, options);
      }

      // Generate reports
      if (options.coverage !== false) {
        await this.generateCoverageReport();
      }

      // Print summary
      this.printSummary();

      const duration = Date.now() - startTime;
      this.results.duration = duration;

      return this.results;

    } catch (error) {
      console.error('❌ Test runner failed:', error.message);
      throw error;
    } finally {
      await this.cleanupTestEnvironment();
    }
  }

  /**
   * Run tests for a specific category
   */
  async runTestCategory(category, options = {}) {
    const config = TEST_CONFIG.categories[category];
    const startTime = Date.now();

    try {
      // Build jest command
      const jestArgs = [
        '--config=jest.config.js',
        `--testTimeout=${config.timeout}`,
        '--verbose',
        '--detectOpenHandles',
        '--forceExit'
      ];

      if (options.watch) {
        jestArgs.push('--watch');
      }

      if (options.updateSnapshots) {
        jestArgs.push('--updateSnapshots');
      }

      const testPattern = options.pattern || config.pattern;
      jestArgs.push(testPattern);

      // Add coverage if enabled
      if (options.coverage !== false && TEST_CONFIG.coverage.enabled) {
        jestArgs.push(
          '--coverage',
          `--coverageReporters=${TEST_CONFIG.coverage.reporters.join(',')}`,
          `--coverageDirectory=${TEST_CONFIG.coverage.outputDir}`,
          '--collectCoverageOnlyFrom=src/bsc/**/*.{ts,js}'
        );
      }

      // Execute tests
      console.log(`   Command: npx jest ${jestArgs.join(' ')}`);

      const testOutput = execSync(`npx jest ${jestArgs.join(' ')}`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });

      // Parse results (simplified parsing)
      const categoryResults = this.parseTestOutput(testOutput);
      categoryResults.duration = Date.now() - startTime;

      this.results.categories[category] = categoryResults;
      this.results.total += categoryResults.total;
      this.results.passed += categoryResults.passed;
      this.results.failed += categoryResults.failed;
      this.results.skipped += categoryResults.skipped;

      console.log(`   ✅ ${category} completed: ${categoryResults.passed}/${categoryResults.total} passed`);

    } catch (error) {
      const failedResults = {
        total: 1,
        passed: 0,
        failed: 1,
        skipped: 0,
        duration: Date.now() - startTime,
        error: error.message
      };

      this.results.categories[category] = failedResults;
      this.results.total += 1;
      this.results.failed += 1;

      console.log(`   ❌ ${category} failed: ${error.message}`);
    }
  }

  /**
   * Parse jest test output
   */
  parseTestOutput(output) {
    const lines = output.split('\n');
    const results = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0
    };

    // Look for test summary line
    const summaryLine = lines.find(line => line.includes('Test Suites:') && line.includes('passed'));

    if (summaryLine) {
      const match = summaryLine.match(/(\d+) passed, (\d+) failed/);
      if (match) {
        results.passed = parseInt(match[1]);
        results.failed = parseInt(match[2]);
        results.total = results.passed + results.failed;
      }
    }

    return results;
  }

  /**
   * Setup test environment
   */
  async setupTestEnvironment() {
    console.log('🔧 Setting up test environment...');

    // Ensure test directories exist
    const testDirs = [
      'tests/unit',
      'tests/integration',
      'tests/e2e',
      'tests/setup',
      'tests/mocks',
      'coverage'
    ];

    for (const dir of testDirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    // Set environment variables
    process.env.NODE_ENV = 'test';
    process.env.BSC_NETWORK = 'testnet';
    process.env.LOG_LEVEL = 'info';

    console.log('   ✅ Test environment ready');
  }

  /**
   * Cleanup test environment
   */
  async cleanupTestEnvironment() {
    console.log('🧹 Cleaning up test environment...');

    // Cleanup any test databases, temp files, etc.
    // This would be implementation-specific

    console.log('   ✅ Cleanup completed');
  }

  /**
   * Generate coverage report
   */
  async generateCoverageReport() {
    if (!TEST_CONFIG.coverage.enabled) return;

    console.log('\n📊 Generating coverage report...');

    const coverageDir = TEST_CONFIG.coverage.outputDir;
    if (fs.existsSync(coverageDir)) {
      console.log(`   Coverage report generated: ${coverageDir}/index.html`);

      // Check coverage thresholds
      const coverageFile = path.join(coverageDir, 'coverage-summary.json');
      if (fs.existsSync(coverageFile)) {
        const coverage = JSON.parse(fs.readFileSync(coverageFile, 'utf8'));
        this.checkCoverageThresholds(coverage);
      }
    }
  }

  /**
   * Check if coverage meets thresholds
   */
  checkCoverageThresholds(coverage) {
    const thresholds = TEST_CONFIG.coverage.thresholds;
    const total = coverage.total;

    console.log('   Coverage Summary:');
    console.log(`   - Lines: ${total.lines.pct}% (${thresholds.lines}% required)`);
    console.log(`   - Functions: ${total.functions.pct}% (${thresholds.functions}% required)`);
    console.log(`   - Branches: ${total.branches.pct}% (${thresholds.branches}% required)`);
    console.log(`   - Statements: ${total.statements.pct}% (${thresholds.statements}% required)`);

    const failures = [];
    if (total.lines.pct < thresholds.lines) failures.push('lines');
    if (total.functions.pct < thresholds.functions) failures.push('functions');
    if (total.branches.pct < thresholds.branches) failures.push('branches');
    if (total.statements.pct < thresholds.statements) failures.push('statements');

    if (failures.length > 0) {
      console.log(`   ❌ Coverage thresholds not met for: ${failures.join(', ')}`);
    } else {
      console.log('   ✅ All coverage thresholds met');
    }
  }

  /**
   * Print test summary
   */
  printSummary() {
    console.log('\n📈 Test Results Summary:');
    console.log('═'.repeat(50));

    const { total, passed, failed, skipped, categories } = this.results;

    // Category breakdown
    Object.entries(categories).forEach(([category, results]) => {
      const status = results.failed > 0 ? '❌' : '✅';
      console.log(`${status} ${category.padEnd(15)}: ${results.passed}/${results.total} passed (${results.duration}ms)`);
    });

    console.log('─'.repeat(50));
    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${passed} ✅`);
    console.log(`Failed: ${failed} ${failed > 0 ? '❌' : '✅'}`);
    console.log(`Skipped: ${skipped} ⏭️`);
    console.log(`Duration: ${(this.results.duration / 1000).toFixed(2)}s`);
    console.log(`Success Rate: ${total > 0 ? ((passed / total) * 100).toFixed(1) : 0}%`);

    if (failed === 0) {
      console.log('\n🎉 All tests passed! Ready for deployment.');
    } else {
      console.log(`\n⚠️  ${failed} test(s) failed. Please review and fix before deployment.`);
    }
  }

  /**
   * Watch mode for development
   */
  async watchTests(categories = ['unit']) {
    console.log('👀 Starting test watch mode...\n');

    await this.runTests(categories, {
      watch: true,
      coverage: false
    });
  }

  /**
   * Run tests with coverage for CI/CD
   */
  async runCI() {
    console.log('🤖 Running tests for CI/CD pipeline...\n');

    const results = await this.runTests(Object.keys(TEST_CONFIG.categories), {
      coverage: true,
      updateSnapshots: false
    });

    // Exit with appropriate code for CI
    if (results.failed > 0) {
      process.exit(1);
    }

    return results;
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const runner = new TestRunner();

  try {
    if (args.includes('--watch') || args.includes('-w')) {
      const categories = args.filter(arg => !arg.startsWith('-')).length > 0
        ? args.filter(arg => !arg.startsWith('-'))
        : ['unit'];

      await runner.watchTests(categories);
    } else if (args.includes('--ci')) {
      await runner.runCI();
    } else {
      const categories = args.length > 0 && !args[0].startsWith('-')
        ? args
        : Object.keys(TEST_CONFIG.categories);

      const options = {
        coverage: !args.includes('--no-coverage'),
        updateSnapshots: args.includes('--update-snapshots')
      };

      await runner.runTests(categories, options);
    }
  } catch (error) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  }
}

// Export for programmatic use
module.exports = TestRunner;

// Run CLI if called directly
if (require.main === module) {
  main();
}