#!/bin/bash

# BSC DEX Integration Platform - Deployment Script
# This script automates the deployment process for production environments

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="bsc-dex"
DEPLOYMENT_ENV=${1:-production}
BACKUP_BEFORE_DEPLOY=${2:-true}
HEALTH_CHECK_TIMEOUT=300

# Logging
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

log_success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] ✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] ⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ❌ $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."

    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi

    # Check if Docker Compose is installed
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi

    # Check if .env file exists
    if [ ! -f .env ]; then
        log_error ".env file not found. Please create it from .env.production"
        exit 1
    fi

    # Check if required directories exist
    for dir in logs uploads nginx ssl; do
        if [ ! -d "$dir" ]; then
            log_warning "Directory $dir does not exist. Creating it..."
            mkdir -p "$dir"
        fi
    done

    log_success "Prerequisites check completed"
}

# Backup current deployment
backup_deployment() {
    if [ "$BACKUP_BEFORE_DEPLOY" = true ]; then
        log "Creating backup of current deployment..."

        BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"
        mkdir -p "$BACKUP_DIR"

        # Backup database
        if docker-compose ps postgres | grep -q "Up"; then
            log "Backing up database..."
            docker-compose exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > "$BACKUP_DIR/database.sql"
        fi

        # Backup Redis
        if docker-compose ps redis | grep -q "Up"; then
            log "Backing up Redis data..."
            docker-compose exec -T redis redis-cli --rdb - > "$BACKUP_DIR/redis.rdb" 2>/dev/null || true
        fi

        # Backup configuration files
        cp -r ./nginx "$BACKUP_DIR/"
        cp .env "$BACKUP_DIR/"
        cp docker-compose.yml "$BACKUP_DIR/"

        log_success "Backup created at $BACKUP_DIR"
    fi
}

# Build and deploy services
deploy_services() {
    log "Starting deployment process..."

    # Pull latest images
    log "Pulling latest Docker images..."
    docker-compose -f docker-compose.prod.yml pull

    # Build custom images
    log "Building application images..."
    docker-compose -f docker-compose.prod.yml build --no-cache

    # Stop existing services
    log "Stopping existing services..."
    docker-compose -f docker-compose.prod.yml down

    # Start new services
    log "Starting new services..."
    docker-compose -f docker-compose.prod.yml up -d

    log_success "Services deployed successfully"
}

# Run database migrations
run_migrations() {
    log "Running database migrations..."

    # Wait for database to be ready
    log "Waiting for database to be ready..."
    for i in {1..30}; do
        if docker-compose -f docker-compose.prod.yml exec -T postgres pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; then
            break
        fi
        sleep 2
    done

    # Run migrations
    docker-compose -f docker-compose.prod.yml exec -T api npx prisma migrate deploy

    log_success "Database migrations completed"
}

# Health check
health_check() {
    log "Performing health checks..."

    local timeout=$HEALTH_CHECK_TIMEOUT
    local interval=10
    local elapsed=0

    while [ $elapsed -lt $timeout ]; do
        if curl -f http://localhost:3000/health >/dev/null 2>&1; then
            log_success "Application is healthy"
            return 0
        fi

        sleep $interval
        elapsed=$((elapsed + interval))
        log "Health check... ($elapsed/$timeout seconds)"
    done

    log_error "Health check failed after $timeout seconds"
    return 1
}

# Cleanup old images and containers
cleanup() {
    log "Cleaning up old Docker resources..."

    # Remove unused images
    docker image prune -f

    # Remove unused containers
    docker container prune -f

    # Remove unused volumes (be careful with this)
    # docker volume prune -f

    log_success "Cleanup completed"
}

# Show deployment status
show_status() {
    log "Deployment status:"
    docker-compose -f docker-compose.prod.yml ps

    log "Service logs (last 20 lines):"
    docker-compose -f docker-compose.prod.yml logs --tail=20 api
}

# Send notification (optional)
send_notification() {
    local status=$1
    local message="Deployment $status for $PROJECT_NAME on $DEPLOYMENT_ENV"

    # Send to Slack (if configured)
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"$message\"}" \
            "$SLACK_WEBHOOK_URL" 2>/dev/null || true
    fi

    # Send email (if configured)
    if [ -n "$DEPLOYMENT_NOTIFICATION_EMAIL" ] && command -v mail &> /dev/null; then
        echo "$message" | mail -s "Deployment Notification: $PROJECT_NAME" "$DEPLOYMENT_NOTIFICATION_EMAIL" 2>/dev/null || true
    fi
}

# Rollback function
rollback() {
    log_error "Deployment failed. Initiating rollback..."

    # Stop current services
    docker-compose -f docker-compose.prod.yml down

    # Restore from latest backup if available
    LATEST_BACKUP=$(ls -t ./backups/ | head -n 1)
    if [ -n "$LATEST_BACKUP" ]; then
        log "Rolling back to backup: $LATEST_BACKUP"

        # Restore database
        if [ -f "./backups/$LATEST_BACKUP/database.sql" ]; then
            docker-compose -f docker-compose.prod.yml up -d postgres
            sleep 10
            docker-compose -f docker-compose.prod.yml exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "./backups/$LATEST_BACKUP/database.sql"
        fi

        log_success "Rollback completed"
    else
        log_error "No backup found for rollback"
    fi

    send_notification "ROLLED BACK"
}

# Main deployment function
main() {
    log "Starting deployment of $PROJECT_NAME to $DEPLOYMENT_ENV environment"

    # Trap errors and rollback
    trap 'rollback; exit 1' ERR

    # Run deployment steps
    check_prerequisites
    backup_deployment
    deploy_services
    run_migrations

    # Wait for services to be ready
    sleep 30

    # Health check
    if health_check; then
        cleanup
        show_status
        log_success "Deployment completed successfully! 🚀"
        send_notification "SUCCESSFUL"
    else
        rollback
        exit 1
    fi
}

# Script usage
usage() {
    echo "Usage: $0 [environment] [backup_before_deploy]"
    echo "  environment: production (default), staging, development"
    echo "  backup_before_deploy: true (default), false"
    echo ""
    echo "Examples:"
    echo "  $0 production true"
    echo "  $0 staging false"
    echo ""
    echo "Environment variables:"
    echo "  SLACK_WEBHOOK_URL: Slack webhook for notifications"
    echo "  DEPLOYMENT_NOTIFICATION_EMAIL: Email for notifications"
}

# Handle script arguments
case "${1:-}" in
    -h|--help)
        usage
        exit 0
        ;;
    *)
        main
        ;;
esac