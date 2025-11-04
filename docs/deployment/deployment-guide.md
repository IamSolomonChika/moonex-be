# BSC DEX Integration Platform - Deployment Guide

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Environment Setup](#environment-setup)
4. [Configuration](#configuration)
5. [Deployment Methods](#deployment-methods)
6. [Monitoring and Maintenance](#monitoring-and-maintenance)
7. [Troubleshooting](#troubleshooting)
8. [Security Considerations](#security-considerations)

## Overview

This guide provides comprehensive instructions for deploying the BSC DEX Integration Platform to production environments. The platform is designed to be deployed using Docker containers with support for various deployment scenarios.

### Deployment Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Nginx Proxy   │────│   API Gateway   │────│  Load Balancer  │
│   (SSL/TLS)     │    │   (Rate Limiter)│    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
┌───────▼────────┐    ┌─────────▼────────┐    ┌────────▼────────┐
│  API Service   │    │  Background      │    │  WebSocket      │
│  (Fastify)     │    │  Worker          │    │  Service        │
└────────────────┘    └──────────────────┘    └─────────────────┘
        │                       │                       │
        └───────────────────────┼───────────────────────┘
                                │
    ┌───────────────────────────▼───────────────────────────┐
    │                   Data Layer                          │
    │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
    │  │ PostgreSQL  │  │   Redis     │  │  File       │   │
    │  │ Database    │  │   Cache     │  │  Storage    │   │
    │  └─────────────┘  └─────────────┘  └─────────────┘   │
    └───────────────────────────────────────────────────────┘
```

## Prerequisites

### Infrastructure Requirements

**Minimum Server Specifications:**
- CPU: 4 cores
- RAM: 8GB
- Storage: 100GB SSD
- Network: 1Gbps connection

**Recommended Server Specifications:**
- CPU: 8 cores
- RAM: 16GB
- Storage: 200GB SSD
- Network: 10Gbps connection

### Software Requirements

- **Docker**: 20.10+
- **Docker Compose**: 2.0+
- **Operating System**: Ubuntu 20.04+ / CentOS 8+ / Amazon Linux 2
- **SSL Certificate**: Valid certificate for your domain
- **Domain**: Configured domain name pointing to your server

### Network Requirements

- **Ports**: 80 (HTTP), 443 (HTTPS), 22 (SSH)
- **Outbound**: Access to BSC RPC endpoints, third-party APIs
- **Firewall**: Proper firewall configuration

## Environment Setup

### 1. Server Preparation

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Add user to docker group
sudo usermod -aG docker $USER
```

### 2. Application Setup

```bash
# Clone the repository
git clone https://github.com/your-org/bsc-dex.git
cd bsc-dex

# Create necessary directories
mkdir -p logs uploads ssl nginx/sites-available backups

# Set permissions
sudo chown -R $USER:$USER .
chmod 755 scripts/*.sh
```

### 3. SSL Certificate Setup

#### Using Let's Encrypt (Recommended)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Generate SSL certificate
sudo certbot certonly --nginx -d bsc-dex.com -d api.bsc-dex.com

# Copy certificates to project directory
sudo cp /etc/letsencrypt/live/bsc-dex.com/fullchain.pem ./ssl/bsc-dex.com.crt
sudo cp /etc/letsencrypt/live/bsc-dex.com/privkey.pem ./ssl/bsc-dex.com.key
sudo cp /etc/letsencrypt/live/bsc-dex.com/chain.pem ./ssl/bsc-dex.com.ca-bundle
```

#### Using Custom Certificates

```bash
# Copy your certificates to the ssl directory
cp your-certificate.crt ./ssl/bsc-dex.com.crt
cp your-private-key.key ./ssl/bsc-dex.com.key
cp your-ca-bundle.ca ./ssl/bsc-dex.com.ca-bundle
```

## Configuration

### 1. Environment Configuration

```bash
# Copy the production environment template
cp .env.production .env

# Edit the environment file
nano .env
```

**Critical Configuration Items:**

```bash
# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/bsc_dex
POSTGRES_PASSWORD=your_secure_password

# Redis Configuration
REDIS_PASSWORD=your_redis_password

# Security Keys (generate secure random strings)
JWT_SECRET=your_32_character_minimum_secret
ENCRYPTION_KEY=your_32_character_minimum_key
WEBHOOK_SECRET=your_32_character_minimum_secret

# API Keys
WALLET_CONNECT_PROJECT_ID=your_wallet_connect_project_id
COINGECKO_API_KEY=your_coingecko_api_key
MORALIS_API_KEY=your_moralis_api_key
ONE_INCH_API_KEY=your_one_inch_api_key

# BSC Configuration
BSC_RPC_URL=https://bsc-dataseed1.binance.org/
PANCAKESWAP_ROUTER=0x10ED43C718714eb63d5aA57B78B54704E256024E
```

### 2. Nginx Configuration

Update the server names in `nginx/sites-available/bsc-dex.conf`:

```nginx
server_name bsc-dex.com www.bsc-dex.com api.bsc-dex.com;
```

### 3. Docker Compose Configuration

Review and update `docker-compose.prod.yml` if needed:

```yaml
# Adjust resource limits if necessary
deploy:
  resources:
    limits:
      memory: 2G
    reservations:
      memory: 1G
```

## Deployment Methods

### Method 1: Automated Deployment (Recommended)

```bash
# Deploy to production
./scripts/deploy.sh production true

# Deploy to staging
./scripts/deploy.sh staging true

# Deploy without backup
./scripts/deploy.sh production false
```

### Method 2: Manual Deployment

```bash
# Build and start services
docker-compose -f docker-compose.prod.yml up -d --build

# Run database migrations
docker-compose -f docker-compose.prod.yml exec api npx prisma migrate deploy

# Check service status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f api
```

### Method 3: CI/CD Deployment

The platform includes GitHub Actions workflows for automated deployment:

1. **Push to main branch**: Auto-deploy to staging
2. **Create release tag**: Deploy to production
3. **Manual trigger**: Deploy via GitHub Actions UI

## Monitoring and Maintenance

### 1. Health Checks

```bash
# Check application health
curl https://api.bsc-dex.com/health

# Check all services
docker-compose -f docker-compose.prod.yml ps
```

### 2. Log Management

```bash
# View application logs
docker-compose -f docker-compose.prod.yml logs -f api

# View nginx logs
tail -f logs/nginx/access.log

# View error logs
tail -f logs/nginx/error.log
```

### 3. Database Maintenance

```bash
# Connect to database
docker-compose -f docker-compose.prod.yml exec postgres psql -U bsc_dex_user -d bsc_dex

# Create backup
docker-compose -f docker-compose.prod.yml exec postgres pg_dump -U bsc_dex_user bsc_dex > backup.sql

# Restore backup
docker-compose -f docker-compose.prod.yml exec -T postgres psql -U bsc_dex_user bsc_dex < backup.sql
```

### 4. Performance Monitoring

Access monitoring dashboards:
- **Grafana**: `https://your-domain:3001` (configured in docker-compose)
- **Prometheus**: `https://your-domain:9090`

## Troubleshooting

### Common Issues

#### 1. Database Connection Failed

```bash
# Check database status
docker-compose -f docker-compose.prod.yml ps postgres

# Check database logs
docker-compose -f docker-compose.prod.yml logs postgres

# Restart database
docker-compose -f docker-compose.prod.yml restart postgres
```

#### 2. Redis Connection Failed

```bash
# Check Redis status
docker-compose -f docker-compose.prod.yml ps redis

# Test Redis connection
docker-compose -f docker-compose.prod.yml exec redis redis-cli ping
```

#### 3. SSL Certificate Issues

```bash
# Check certificate validity
openssl x509 -in ./ssl/bsc-dex.com.crt -text -noout

# Check certificate expiration
openssl x509 -in ./ssl/bsc-dex.com.crt -noout -dates

# Renew certificate
sudo certbot renew
```

#### 4. High Memory Usage

```bash
# Check container resource usage
docker stats

# Optimize configuration
# Edit docker-compose.prod.yml to adjust memory limits
```

### Emergency Procedures

#### Rollback to Previous Version

```bash
# List available backups
./scripts/rollback.sh --list

# Rollback to latest backup
./scripts/rollback.sh production

# Rollback to specific backup
./scripts/rollback.sh production 20231201_143022
```

#### Emergency Shutdown

```bash
# Stop all services
docker-compose -f docker-compose.prod.yml down

# Force stop if needed
docker-compose -f docker-compose.prod.yml kill
```

## Security Considerations

### 1. Server Security

```bash
# Configure firewall
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443

# Disable root login
sudo sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
sudo systemctl restart ssh
```

### 2. Application Security

- **Environment Variables**: Never commit `.env` files to version control
- **Secrets Management**: Use secure secrets management in production
- **Database Access**: Restrict database access to application containers only
- **SSL/TLS**: Always use HTTPS in production
- **API Keys**: Rotate API keys regularly

### 3. Monitoring Security

- **Access Logs**: Monitor all API access logs
- **Failed Attempts**: Monitor failed authentication attempts
- **Resource Usage**: Monitor for unusual resource consumption
- **Security Updates**: Keep all dependencies updated

### 4. Backup Security

```bash
# Encrypt backups
gpg --symmetric --cipher-algo AES256 backup.sql

# Store backups securely (AWS S3, Google Cloud Storage, etc.)
aws s3 cp backup.sql.gpg s3://your-backup-bucket/
```

## Performance Optimization

### 1. Database Optimization

```sql
-- Create indexes for frequently queried columns
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_timestamp ON transactions(created_at);

-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM transactions WHERE user_id = 'user123';
```

### 2. Redis Optimization

```bash
# Configure Redis memory policy
redis-cli CONFIG SET maxmemory-policy allkeys-lru

# Monitor Redis performance
redis-cli INFO memory
```

### 3. Nginx Optimization

```nginx
# Enable HTTP/2
listen 443 ssl http2;

# Optimize caching
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

## Scaling Considerations

### Horizontal Scaling

1. **Load Balancer**: Use multiple API instances behind a load balancer
2. **Database**: Consider read replicas for read-heavy workloads
3. **Redis**: Use Redis Cluster for high availability
4. **File Storage**: Use distributed file storage (AWS S3, etc.)

### Vertical Scaling

1. **Increase Resources**: Add more CPU and RAM to containers
2. **Connection Pooling**: Optimize database connection pools
3. **Caching**: Implement aggressive caching strategies

## Support and Maintenance

### Regular Maintenance Tasks

1. **Daily**: Monitor system health and logs
2. **Weekly**: Review performance metrics and security logs
3. **Monthly**: Apply security updates and patches
4. **Quarterly**: Review and update deployment procedures

### Getting Help

- **Documentation**: [docs.bsc-dex.com](https://docs.bsc-dex.com)
- **Support**: support@bsc-dex.com
- **Issues**: [GitHub Issues](https://github.com/your-org/bsc-dex/issues)
- **Community**: [Telegram Channel](https://t.me/bsc_dex_support)

---

**Note**: This deployment guide is continuously updated. Always refer to the latest version in the repository.