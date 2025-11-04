#!/usr/bin/env ts-node

/**
 * API Documentation Generation Script
 * Generates comprehensive OpenAPI 3.0 documentation for BSC DEX integration
 */

import { BSCAPIDocumentationGenerator } from '../src/docs/api-documentation-generator.js';

// Configuration
const config = {
  title: 'BSC DEX Integration API',
  version: '2.0.0',
  description: 'Comprehensive BSC DEX integration platform with PancakeSwap support, token trading, liquidity management, yield farming, and portfolio analytics',
  servers: [
    {
      url: 'https://api.bsc-dex.com/v1',
      description: 'Production Server'
    },
    {
      url: 'https://staging-api.bsc-dex.com/v1',
      description: 'Staging Server'
    },
    {
      url: 'http://localhost:3000/v1',
      description: 'Development Server'
    }
  ],
  contact: {
    name: 'BSC DEX API Support',
    email: 'api-support@bsc-dex.com',
    url: 'https://docs.bsc-dex.com'
  },
  license: {
    name: 'MIT',
    url: 'https://opensource.org/licenses/MIT'
  },
  outputDir: './docs/api',
  includeExamples: true,
  generatePostmanCollection: true,
  generateSDKs: false
};

/**
 * Mock Fastify instance for documentation generation
 */
class MockFastifyInstance {
  private routes: any[] = [];

  register() {
    return this;
  }

  get() {
    return this;
  }

  post() {
    return this;
  }

  put() {
    return this;
  }

  delete() {
    return this;
  }

  patch() {
    return this;
  }
}

/**
 * Generate API documentation
 */
async function generateAPIDocumentation(): Promise<void> {
  console.log('🚀 Starting API documentation generation...');

  try {
    // Create mock Fastify instance (in real usage, this would be your actual Fastify app)
    const mockFastify = new MockFastifyInstance() as any;

    // Initialize documentation generator
    const docGenerator = new BSCAPIDocumentationGenerator(mockFastify, config);

    // Generate comprehensive documentation
    await docGenerator.generateDocumentation();

    console.log('✅ API documentation generated successfully!');
    console.log(`📁 Documentation location: ${config.outputDir}`);
    console.log(`🌐 Interactive docs: http://localhost:3000/docs`);
    console.log(`📋 OpenAPI spec: ${config.outputDir}/openapi.json`);

    // Log statistics
    const openAPIDoc = docGenerator.getOpenAPIDocument();
    const endpointCount = Object.keys(openAPIDoc.paths).length;
    const schemaCount = Object.keys(openAPIDoc.components.schemas || {}).length;

    console.log(`📊 Generated ${endpointCount} API endpoints`);
    console.log(`📋 Created ${schemaCount} data schemas`);
    console.log(`📖 Available in JSON, YAML, and HTML formats`);

    if (config.generatePostmanCollection) {
      console.log(`📮 Postman collection: ${config.outputDir}/collections/postman_collection.json`);
    }

    console.log('\n🎉 Documentation generation complete!');
    console.log('\nNext steps:');
    console.log('1. Review the generated documentation');
    console.log('2. Test the interactive API explorer');
    console.log('3. Import the Postman collection for testing');
    console.log('4. Share the documentation with your team');

  } catch (error) {
    console.error('❌ Failed to generate API documentation:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

/**
 * Validate configuration
 */
function validateConfig(): void {
  if (!config.title) {
    throw new Error('API title is required');
  }

  if (!config.version) {
    throw new Error('API version is required');
  }

  if (!config.description) {
    throw new Error('API description is required');
  }

  if (!config.outputDir) {
    throw new Error('Output directory is required');
  }

  if (!config.servers || config.servers.length === 0) {
    throw new Error('At least one server URL is required');
  }
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  try {
    console.log('🚀 Starting BSC DEX API Documentation Generator');

    // Validate configuration
    validateConfig();

    // Generate documentation
    await generateAPIDocumentation();

    console.log('✨ All done! Your API documentation is ready.');

  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('\n💥 Unhandled error:', error);
    process.exit(1);
  });
}

export { generateAPIDocumentation, config };