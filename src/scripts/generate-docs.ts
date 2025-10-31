#!/usr/bin/env ts-node

import { createServer } from '../index';
import OpenAPIGenerator from '../utils/openapi-generator';
import path from 'path';

/**
 * Script to generate API documentation
 *
 * Usage:
 * npm run generate-docs
 * or
 * pnpm generate-docs
 */

async function generateDocs() {
  console.log('🚀 Starting API documentation generation...');

  try {
    // Create Fastify server instance
    const fastify = await createServer();

    // Initialize OpenAPI generator
    const generator = new OpenAPIGenerator(fastify, {
      outputPath: './api-docs',
      includeExamples: true,
      info: {
        title: 'MoonEx API',
        version: '1.0.0',
        description: 'Comprehensive DeFi trading and wallet management API for the MoonEx platform',
        contact: {
          name: 'MoonEx Team',
          email: 'support@moonex.io',
          url: 'https://moonex.io'
        },
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT'
        }
      },
      servers: [
        {
          url: 'https://api.moonex.io/v1',
          description: 'Production server'
        },
        {
          url: 'https://staging-api.moonex.io/v1',
          description: 'Staging server'
        },
        {
          url: 'http://localhost:3000/api/v1',
          description: 'Development server'
        }
      ]
    });

    // Generate and export documentation
    await generator.exportDocumentation();

    console.log('✅ API documentation generated successfully!');
    console.log('📁 Documentation available in: ./api-docs/');
    console.log('🌐 Interactive docs available at:');
    console.log('   - Swagger UI: ./api-docs/index.html');
    console.log('   - ReDoc: ./api-docs/redoc.html');
    console.log('📋 Postman collection: ./api-docs/collections/postman_collection.json');
    console.log('📖 OpenAPI spec: ./api-docs/openapi.yaml');

    // Close server
    await fastify.close();

    process.exit(0);
  } catch (error) {
    console.error('❌ Error generating documentation:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  generateDocs();
}

export default generateDocs;