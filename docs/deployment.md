# MoonEx Deployment Guide

This guide covers deployment options and configurations for the MoonEx backend API.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Configuration](#environment-configuration)
- [Deployment Options](#deployment-options)
- [Docker Deployment](#docker-deployment)
- [Cloud Platform Deployment](#cloud-platform-deployment)
- [Monitoring and Logging](#monitoring-and-logging)
- [Security Considerations](#security-considerations)
- [Troubleshooting](#troubleshooting)

## Prerequisites

Before deploying MoonEx, ensure you have:

- Node.js 18+ runtime environment
- Privy account with production application configured
- Domain name (for production)
- SSL certificate
- Database or storage solution (if persisting data)
- Monitoring and logging tools

## Environment Configuration

### Production Environment Variables

Create a production environment file with the following variables:

```bash
# Privy Configuration
PRIVY_APP_ID=your_production_app_id
PRIVY_APP_SECRET=your_production_app_secret

# Server Configuration
NODE_ENV=production
PORT=3000

# JWT Configuration
JWT_SECRET=your_secure_jwt_secret_at_least_32_characters
JWT_EXPIRES_IN=7d

# CORS Configuration
CORS_ORIGIN=https://yourdomain.com

# Database Configuration (if applicable)
DATABASE_URL=your_production_database_url

# Monitoring Configuration
LOG_LEVEL=info
SENTRY_DSN=your_sentry_dsn

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Security Best Practices

1. **Use environment-specific secrets**: Never use development secrets in production
2. **Enable HTTPS**: Always use SSL/TLS in production
3. **Configure CORS**: Restrict to your domain only
4. **Set secure headers**: Implement security headers
5. **Enable rate limiting**: Prevent abuse and DDoS attacks

## Deployment Options

### Option 1: Docker Deployment

#### Dockerfile

```dockerfile
# Multi-stage build for production
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install pnpm and dependencies
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN pnpm build

# Production stage
FROM node:18-alpine AS production

# Install pnpm
RUN npm install -g pnpm

# Create app directory
WORKDIR /app

# Copy package files and install production dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# Copy built application
COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership of the app directory
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["node", "build/index.js"]
```

#### Docker Compose

```yaml
version: "3.8"

services:
  moonex-api:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PRIVY_APP_ID=${PRIVY_APP_ID}
      - PRIVY_APP_SECRET=${PRIVY_APP_SECRET}
      - JWT_SECRET=${JWT_SECRET}
    restart: unless-stopped
    healthcheck:
      test:
        [
          "CMD",
          "node",
          "-e",
          "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })",
        ]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - moonex-network

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - moonex-api
    restart: unless-stopped
    networks:
      - moonex-network

networks:
  moonex-network:
    driver: bridge
```

#### Nginx Configuration

```nginx
events {
    worker_connections 1024;
}

http {
    upstream moonex_api {
        server moonex-api:3000;
    }

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

    server {
        listen 80;
        server_name yourdomain.com;
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name yourdomain.com;

        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
        ssl_prefer_server_ciphers off;

        # Security headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
        add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";

        location / {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://moonex_api;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

### Option 2: Cloud Platform Deployment

#### AWS Deployment

1. **Using AWS ECS**

Create an ECS task definition:

```json
{
  "family": "moonex-api",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::account:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "moonex-api",
      "image": "your-registry/moonex-api:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ],
      "secrets": [
        {
          "name": "PRIVY_APP_ID",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:privy-app-id"
        },
        {
          "name": "PRIVY_APP_SECRET",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:privy-app-secret"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/moonex-api",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

2. **Using AWS Lambda**

Create a Lambda function handler:

```typescript
// lambda-handler.ts
import { Handler } from "aws-lambda";
import { createServer } from "./build/index";

let server: any;

export const handler: Handler = async (event, context) => {
  if (!server) {
    server = await createServer();
    await server.ready();
  }

  const response = await server.inject({
    method: event.httpMethod,
    url: event.path,
    headers: event.headers,
    payload: event.body,
    query: event.queryStringParameters,
  });

  return {
    statusCode: response.statusCode,
    headers: response.headers,
    body: response.body,
  };
};
```

#### Google Cloud Platform

1. **Using Cloud Run**

```bash
# Build and deploy to Cloud Run
gcloud builds submit --tag gcr.io/PROJECT-ID/moonex-api
gcloud run deploy moonex-api --image gcr.io/PROJECT-ID/moonex-api --platform managed
```

2. **Using App Engine**

Create `app.yaml`:

```yaml
runtime: nodejs18
instance_class: F2
env_variables:
  NODE_ENV: production
  PORT: 8080
automatic_scaling:
  min_instances: 1
  max_instances: 10
  target_cpu_utilization: 0.65
```

#### Vercel Deployment

Create `vercel.json`:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "build/index.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "build/index.js"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  }
}
```

## Monitoring and Logging

### Application Monitoring

1. **Health Check Endpoint**

The application includes a health check endpoint at `/health`:

```typescript
// Health check response
{
  "status": "ok",
  "message": "MoonEx API is running",
  "timestamp": "2023-01-01T00:00:00.000Z",
  "version": "1.0.0"
}
```

2. **Metrics Collection**

Implement metrics collection using Prometheus:

```typescript
// src/middleware/metrics.ts
import client from "prom-client";

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code"],
  registers: [register],
});

export { register, httpRequestDuration };
```

3. **Logging**

Configure structured logging:

```typescript
// src/utils/logger.ts
import pino from "pino";

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  formatters: {
    level: (label) => ({ level: label }),
    log: (object) => ({
      ...object,
      service: "moonex-api",
      version: process.env.npm_package_version,
    }),
  },
});

export default logger;
```

### Infrastructure Monitoring

1. **Container Monitoring**

Use Docker health checks and container orchestration monitoring:

```yaml
# docker-compose.yml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

2. **Cloud Provider Monitoring**

Set up monitoring dashboards:

- AWS CloudWatch
- Google Cloud Monitoring
- Azure Monitor

## Security Considerations

### SSL/TLS Configuration

1. **Obtain SSL Certificate**

```bash
# Using Let's Encrypt
certbot certonly --webroot -w /var/www/html -d yourdomain.com
```

2. **Configure SSL**

```nginx
ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
```

### Firewall Configuration

```bash
# UFW configuration
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

### Secret Management

1. **Environment Variables**

Store secrets in environment variables or secret management services:

- AWS Secrets Manager
- Google Secret Manager
- HashiCorp Vault

2. **Container Secrets**

```yaml
# docker-compose.yml
secrets:
  privy_app_id:
    external: true
  privy_app_secret:
    external: true

services:
  moonex-api:
    secrets:
      - privy_app_id
      - privy_app_secret
```

## Performance Optimization

### Caching Strategy

1. **Redis Caching**

```typescript
// src/services/cache.ts
import Redis from "ioredis";

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD,
});

export const cache = {
  get: (key: string) => redis.get(key),
  set: (key: string, value: string, ttl?: number) =>
    ttl ? redis.setex(key, ttl, value) : redis.set(key, value),
  del: (key: string) => redis.del(key),
};
```

2. **HTTP Caching**

```typescript
// Cache middleware
app.addHook("onSend", async (request, reply, payload) => {
  if (request.routeOptions.config.cache) {
    reply.header("Cache-Control", "public, max-age=300");
  }
  return payload;
});
```

### Load Balancing

1. **Nginx Load Balancing**

```nginx
upstream moonex_api {
    server moonex-api-1:3000;
    server moonex-api-2:3000;
    server moonex-api-3:3000;
}
```

2. **Cloud Load Balancer**

- AWS ALB/NLB
- Google Cloud Load Balancer
- Azure Load Balancer

## Troubleshooting

### Common Issues

1. **Application Won't Start**

```bash
# Check logs
docker logs moonex-api

# Check environment variables
docker exec moonex-api env

# Check port availability
netstat -tulpn | grep 3000
```

2. **Authentication Failures**

```bash
# Verify Privy configuration
curl -X POST https://auth.privy.io/api/v1/apps/{appId}/users \
  -H "Authorization: Bearer {appSecret}"
```

3. **Memory Issues**

```bash
# Monitor memory usage
docker stats moonex-api

# Check for memory leaks
node --inspect build/index.js
```

### Debugging Tools

1. **Application Logs**

```bash
# View application logs
docker logs -f moonex-api

# Filter logs by level
docker logs moonex-api | grep ERROR
```

2. **Performance Profiling**

```bash
# Enable profiling
node --prof build/index.js

# Analyze profile
node --prof-process isolate-*.log > performance.txt
```

3. **Health Monitoring**

```bash
# Health check script
#!/bin/bash
response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health)
if [ $response != "200" ]; then
    echo "Health check failed with status $response"
    exit 1
fi
```

## Rollback Strategy

### Blue-Green Deployment

1. **Deploy to Green Environment**

```bash
docker-compose -f docker-compose.green.yml up -d
```

2. **Test Green Environment**

```bash
curl http://green.yourdomain.com/health
```

3. **Switch Traffic**

```bash
# Update load balancer configuration
# Point traffic to green environment
```

4. **Decommission Blue Environment**

```bash
docker-compose -f docker-compose.blue.yml down
```

### Database Migrations

```bash
# Run migrations
npm run migrate

# Rollback if needed
npm run migrate:rollback
```

This deployment guide provides comprehensive instructions for deploying the MoonEx API in various environments. Choose the deployment option that best fits your infrastructure and requirements.
