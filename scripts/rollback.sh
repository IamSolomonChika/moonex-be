#!/bin/bash

# BSC DEX Integration Platform - Rollback Script
# This script automates rollback to the previous deployment

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
MAX_BACKUPS=10

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

# Get latest backup
get_latest_backup() {
    local latest_backup=$(ls -t ./backups/ 2>/dev/null | head -n 1)
    echo "$latest_backup"
}

# Rollback database
rollback_database() {
    local backup_dir=$1

    if [ -z "$backup_dir" ]; then
        log_error "No backup directory specified"
        return 1
    fi

    if [ ! -d "./backups/$backup_dir" ]; then
        log_error "Backup directory not found: ./backups/$backup_dir"
        return 1
    fi

    log "Rolling back database..."

    # Stop application services
    docker-compose -f docker-compose.prod.yml stop api worker

    # Restore database
    if [ -f "./backups/$backup_dir/database.sql" ]; then
        log "Restoring database from backup..."

        # Drop existing database
        docker-compose -f docker-compose.prod.yml exec -T postgres psql -U "$POSTGRES_USER" -c "DROP DATABASE IF EXISTS $POSTGRES_DB;" || true

        # Create new database
        docker-compose -f docker-compose.prod.yml exec -T postgres psql -U "$POSTGRES_USER" -c "CREATE DATABASE $POSTGRES_DB;" || true

        # Restore data
        docker-compose -f docker-compose.prod.yml exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "./backups/$backup_dir/database.sql"

        log_success "Database rollback completed"
    else
        log_warning "No database backup found in $backup_dir"
    fi
}

# Rollback configuration
rollback_configuration() {
    local backup_dir=$1

    if [ -f "./backups/$backup_dir/docker-compose.yml" ]; then
        log "Restoring Docker Compose configuration..."
        cp "./backups/$backup_dir/docker-compose.yml" ./docker-compose.prod.yml.backup
    fi

    if [ -f "./backups/$backup_dir/.env" ]; then
        log "Restoring environment configuration..."
        cp "./backups/$backup_dir/.env" ./.env.backup
    fi

    if [ -d "./backups/$backup_dir/nginx" ]; then
        log "Restoring Nginx configuration..."
        cp -r "./backups/$backup_dir/nginx" ./nginx.backup
    fi

    log_success "Configuration rollback completed"
}

# Restart services with backup configuration
restart_services() {
    log "Restarting services with backup configuration..."

    # Stop all services
    docker-compose -f docker-compose.prod.yml down

    # Start services
    docker-compose -f docker-compose.prod.yml up -d

    # Wait for services to be ready
    sleep 30

    log_success "Services restarted"
}

# Health check after rollback
health_check() {
    log "Performing health check after rollback..."

    local timeout=180
    local interval=10
    local elapsed=0

    while [ $elapsed -lt $timeout ]; do
        if curl -f http://localhost:3000/health >/dev/null 2>&1; then
            log_success "Rollback health check passed"
            return 0
        fi

        sleep $interval
        elapsed=$((elapsed + interval))
        log "Rollback health check... ($elapsed/$timeout seconds)"
    done

    log_error "Rollback health check failed"
    return 1
}

# List available backups
list_backups() {
    log "Available backups:"
    if [ -d "./backups" ]; then
        ls -la ./backups/ | grep "^d" | awk '{print $9}' | tail -$MAX_BACKUPS
    else
        log "No backups directory found"
    fi
}

# Show rollback status
show_rollback_status() {
    log "Rollback status:"
    docker-compose -f docker-compose.prod.yml ps

    log "Application logs (last 20 lines):"
    docker-compose -f docker-compose.prod.yml logs --tail=20 api
}

# Send rollback notification
send_rollback_notification() {
    local backup_dir=$1
    local status=$2
    local message="Rollback $status to backup: $backup_dir for $PROJECT_NAME"

    # Send to Slack (if configured)
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"$message\"}" \
            "$SLACK_WEBHOOK_URL" 2>/dev/null || true
    fi

    # Send email (if configured)
    if [ -n "$ROLLBACK_NOTIFICATION_EMAIL" ] && command -v mail &> /dev/null; then
        echo "$message" | mail -s "Rollback Notification: $PROJECT_NAME" "$ROLLBACK_NOTIFICATION_EMAIL" 2>/dev/null || true
    fi
}

# Main rollback function
main() {
    local backup_dir=${2:-""}

    log "Starting rollback for $PROJECT_NAME on $DEPLOYMENT_ENV environment"

    # Check prerequisites
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi

    if [ ! -f .env ]; then
        log_error ".env file not found"
        exit 1
    fi

    # Get backup directory if not specified
    if [ -z "$backup_dir" ]; then
        backup_dir=$(get_latest_backup)
        if [ -z "$backup_dir" ]; then
            log_error "No backups found for rollback"
            list_backups
            exit 1
        fi
    fi

    log "Rolling back to backup: $backup_dir"

    # Confirm rollback
    if [ "$DEPLOYMENT_ENV" = "production" ]; then
        echo -e "${YELLOW}WARNING: You are about to rollback the PRODUCTION environment!${NC}"
        echo "Backup: $backup_dir"
        read -p "Are you sure you want to continue? (yes/no): " -r
        if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
            log "Rollback cancelled"
            exit 0
        fi
    fi

    # Perform rollback
    rollback_database "$backup_dir"
    rollback_configuration "$backup_dir"
    restart_services

    # Health check
    if health_check; then
        show_rollback_status
        log_success "Rollback completed successfully! 🔄"
        send_rollback_notification "$backup_dir" "SUCCESSFUL"
    else
        log_error "Rollback failed!"
        send_rollback_notification "$backup_dir" "FAILED"
        exit 1
    fi
}

# Script usage
usage() {
    echo "Usage: $0 [environment] [backup_directory]"
    echo "  environment: production (default), staging, development"
    echo "  backup_directory: specific backup to rollback to (optional, uses latest if not specified)"
    echo ""
    echo "Examples:"
    echo "  $0 production                    # Rollback to latest backup"
    echo "  $0 production 20231201_143022    # Rollback to specific backup"
    echo "  $0 staging --list                # List available backups"
    echo ""
    echo "Options:"
    echo "  --list: List available backups and exit"
}

# Handle script arguments
case "${1:-}" in
    -h|--help)
        usage
        exit 0
        ;;
    --list)
        list_backups
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac