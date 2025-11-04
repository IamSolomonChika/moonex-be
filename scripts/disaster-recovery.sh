#!/bin/bash

# BSC DEX Integration Platform - Disaster Recovery Script
# This script automates disaster recovery procedures

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="bsc-dex"
BACKUP_BUCKET="bsc-dex-backups"
BACKUP_DATE=${1:-$(date +%Y%m%d)}
BACKUP_LOCATION="/backups/${PROJECT_NAME}/${BACKUP_DATE}"
LOG_FILE="/var/log/${PROJECT_NAME}/disaster-recovery.log"
DR_MODE=${2:-"full"}  # full, database, cache, files, services

# Logging
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}" | tee -a "${LOG_FILE}"
}

log_success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] ✅ $1${NC}" | tee -a "${LOG_FILE}"
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] ⚠️  $1${NC}" | tee -a "${LOG_FILE}"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ❌ $1${NC}" | tee -a "${LOG_FILE}"
}

# Create log directory
mkdir -p "$(dirname "${LOG_FILE}")"

# Pre-flight checks
preflight_checks() {
    log "Performing pre-flight checks..."

    # Check if running as root/sudo
    if [[ $EUID -eq 0 ]]; then
        log_error "This script should not be run as root"
        exit 1
    fi

    # Check Docker
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi

    # Check AWS CLI (for S3 backups)
    if ! command -v aws &> /dev/null; then
        log_warning "AWS CLI not found, S3 backups unavailable"
    fi

    # Check if we're in the right directory
    if [[ ! -f "docker-compose.yml" ]]; then
        log_error "docker-compose.yml not found. Please run from project root."
        exit 1
    fi

    # Check backup availability
    if [[ "${DR_MODE}" == "full" || "${DR_MODE}" == "database" ]]; then
        if [[ ! -d "${BACKUP_LOCATION}" ]]; then
            log_warning "Local backup not found at ${BACKUP_LOCATION}"
            log "Attempting to download from S3..."
            download_backup_from_s3
        fi
    fi

    log_success "Pre-flight checks completed"
}

# Download backup from S3
download_backup_from_s3() {
    if command -v aws &> /dev/null; then
        log "Downloading backup from S3 bucket: ${BACKUP_BUCKET}"

        # Create backup directory
        mkdir -p "${BACKUP_LOCATION}"

        # Download all backup files
        aws s3 sync "s3://${BACKUP_BUCKET}/${BACKUP_DATE}/" "${BACKUP_LOCATION}/" || {
            log_error "Failed to download backup from S3"
            return 1
        }

        log_success "Backup downloaded from S3"
    else
        log_error "AWS CLI not available and local backup not found"
        return 1
    fi
}

# Create current state backup before recovery
create_pre_recovery_backup() {
    log "Creating pre-recovery backup..."

    local pre_recovery_backup="/backups/${PROJECT_NAME}/pre-recovery-$(date +%Y%m%d_%H%M%S)"
    mkdir -p "${pre_recovery_backup}"

    # Backup database
    if docker-compose ps postgres | grep -q "Up"; then
        log "Backing up current database state..."
        docker-compose exec -T postgres pg_dump -U bsc_dex_user bsc_dex > "${pre_recovery_backup}/database.sql"
    fi

    # Backup configuration files
    cp .env "${pre_recovery_backup}/" 2>/dev/null || true
    cp docker-compose.yml "${pre_recovery_backup}/" 2>/dev/null || true

    # Backup current Docker state
    docker-compose ps > "${pre_recovery_backup}/docker-status.txt"

    log_success "Pre-recovery backup created at ${pre_recovery_backup}"
}

# Stop all services
stop_services() {
    log "Stopping all services..."

    # Graceful shutdown
    docker-compose down || true

    # Wait for services to stop
    sleep 10

    # Force stop if needed
    docker-compose kill || true

    log_success "All services stopped"
}

# Database recovery
recover_database() {
    log "Starting database recovery..."

    # Check if backup exists
    if [[ ! -f "${BACKUP_LOCATION}/database.sql" ]]; then
        log_error "Database backup not found at ${BACKUP_LOCATION}/database.sql"
        return 1
    fi

    # Start only database service
    log "Starting PostgreSQL service..."
    docker-compose up -d postgres

    # Wait for database to be ready
    log "Waiting for database to be ready..."
    local max_attempts=30
    local attempt=1

    while [[ $attempt -le $max_attempts ]]; do
        if docker-compose exec -T postgres pg_isready -U bsc_dex_user -d bsc_dex; then
            break
        fi
        log "Database not ready, attempt ${attempt}/${max_attempts}"
        sleep 2
        ((attempt++))
    done

    if [[ $attempt -gt $max_attempts ]]; then
        log_error "Database failed to become ready"
        return 1
    fi

    # Stop application services to prevent connections during restore
    docker-compose stop api worker || true

    # Create backup of current database if it exists
    if docker-compose exec -T postgres pg_isready -U bsc_dex_user -d bsc_dex; then
        log "Creating backup of existing database..."
        docker-compose exec -T postgres pg_dump -U bsc_dex_user bsc_dex > "${BACKUP_LOCATION}/existing-database-backup.sql"
    fi

    # Drop and recreate database
    log "Restoring database from backup..."
    docker-compose exec -T postgres psql -U bsc_dex_user -c "DROP DATABASE IF EXISTS bsc_dex;"
    docker-compose exec -T postgres psql -U bsc_dex_user -c "CREATE DATABASE bsc_dex;"

    # Restore database
    docker-compose exec -T postgres psql -U bsc_dex_user -d bsc_dex < "${BACKUP_LOCATION}/database.sql"

    # Verify database restoration
    log "Verifying database restoration..."
    local table_count=$(docker-compose exec -T postgres psql -U bsc_d_user -d bsc_dex -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | tr -d ' ')

    if [[ $table_count -gt 0 ]]; then
        log_success "Database restored successfully (${table_count} tables)"
    else
        log_error "Database restoration verification failed"
        return 1
    fi

    log_success "Database recovery completed"
}

# Cache recovery
recover_cache() {
    log "Starting cache recovery..."

    # Clear Redis data
    log "Clearing Redis cache..."
    docker-compose restart redis || docker-compose up -d redis

    # Wait for Redis to be ready
    local max_attempts=20
    local attempt=1

    while [[ $attempt -le $max_attempts ]]; do
        if docker-compose exec -T redis redis-cli ping | grep -q "PONG"; then
            break
        fi
        log "Redis not ready, attempt ${attempt}/${max_attempts}"
        sleep 1
        ((attempt++))
    done

    if [[ $attempt -gt $max_attempts ]]; then
        log_error "Redis failed to become ready"
        return 1
    fi

    # Optionally restore cache data if available
    if [[ -f "${BACKUP_LOCATION}/redis-dump.rdb" ]]; then
        log "Restoring Redis data from backup..."
        docker-compose stop redis
        cp "${BACKUP_LOCATION}/redis-dump.rdb" ./data/redis/
        docker-compose start redis
    else
        log "No Redis backup found, starting with empty cache"
        docker-compose exec -T redis redis-cli flushall
    fi

    log_success "Cache recovery completed"
}

# File storage recovery
recover_files() {
    log "Starting file storage recovery..."

    # Create uploads directory if it doesn't exist
    mkdir -p uploads

    # Restore files from backup if available
    if [[ -d "${BACKUP_LOCATION}/uploads" ]]; then
        log "Restoring files from backup..."
        cp -r "${BACKUP_LOCATION}/uploads/"* uploads/ || true
    elif command -v aws &> /dev/null; then
        log "Attempting to restore files from S3..."
        aws s3 sync "s3://${BACKUP_BUCKET}/${BACKUP_DATE}/uploads/" uploads/ || {
            log_warning "Failed to restore files from S3, continuing with empty uploads directory"
        }
    else
        log_warning "No file backup found, starting with empty uploads directory"
    fi

    # Set correct permissions
    chown -R $(id -u):$(id -g) uploads/ 2>/dev/null || true
    chmod -R 755 uploads/ 2>/dev/null || true

    log_success "File storage recovery completed"
}

# Services recovery
recover_services() {
    log "Starting services recovery..."

    # Start all services
    log "Starting all services..."
    docker-compose up -d

    # Wait for services to be ready
    log "Waiting for services to be ready..."
    sleep 30

    # Check service health
    local services=("api" "worker" "postgres" "redis" "nginx")
    local healthy_services=0
    local total_services=${#services[@]}

    for service in "${services[@]}"; do
        if docker-compose ps "${service}" | grep -q "Up"; then
            ((healthy_services++))
            log_success "${service} is healthy"
        else
            log_error "${service} is not healthy"
        fi
    done

    if [[ $healthy_services -eq $total_services ]]; then
        log_success "All services are healthy"
    else
        log_warning "${healthy_services}/${total_services} services are healthy"
    fi
}

# Health checks
health_checks() {
    log "Performing health checks..."

    # API health check
    log "Checking API health..."
    local api_healthy=false

    for attempt in {1..10}; do
        if curl -f http://localhost:3000/health &>/dev/null; then
            api_healthy=true
            log_success "API health check passed"
            break
        fi
        log "API health check attempt ${attempt}/10 failed, retrying..."
        sleep 10
    done

    if [[ "$api_healthy" != true ]]; then
        log_error "API health check failed"
        return 1
    fi

    # Database health check
    log "Checking database health..."
    if docker-compose exec -T postgres pg_isready -U bsc_dex_user -d bsc_dex; then
        log_success "Database health check passed"
    else
        log_error "Database health check failed"
        return 1
    fi

    # Cache health check
    log "Checking cache health..."
    if docker-compose exec -T redis redis-cli ping | grep -q "PONG"; then
        log_success "Cache health check passed"
    else
        log_error "Cache health check failed"
        return 1
    fi

    log_success "All health checks passed"
}

# Post-recovery validation
post_recovery_validation() {
    log "Performing post-recovery validation..."

    # Test critical API endpoints
    local endpoints=(
        "/health"
        "/api/v1/bsc/tokens"
        "/api/v1/bsc/pairs"
    )

    for endpoint in "${endpoints[@]}"; do
        log "Testing endpoint: ${endpoint}"
        if curl -f "http://localhost:3000${endpoint}" &>/dev/null; then
            log_success "Endpoint ${endpoint} is working"
        else
            log_error "Endpoint ${endpoint} failed"
            return 1
        fi
    done

    # Check data integrity
    log "Checking data integrity..."
    local user_count=$(docker-compose exec -T postgres psql -U bsc_dex_user -d bsc_dex -t -c "SELECT COUNT(*) FROM users;" 2>/dev/null | tr -d ' ' || echo "0")
    log "User count: ${user_count}"

    local token_count=$(docker-compose exec -T postgres psql -U bsc_dex_user -d bsc_dex -t -c "SELECT COUNT(*) FROM tokens;" 2>/dev/null | tr -d ' ' || echo "0")
    log "Token count: ${token_count}"

    log_success "Post-recovery validation completed"
}

# Send notification
send_notification() {
    local status=$1
    local message=$2

    log "Sending notification: ${message}"

    # Send to Slack (if configured)
    if [[ -n "${SLACK_WEBHOOK_URL}" ]]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"${message}\"}" \
            "${SLACK_WEBHOOK_URL}" 2>/dev/null || true
    fi

    # Send email (if configured)
    if [[ -n "${NOTIFICATION_EMAIL}" ]] && command -v mail &> /dev/null; then
        echo "${message}" | mail -s "BSC DEX Disaster Recovery ${status}" "${NOTIFICATION_EMAIL}" 2>/dev/null || true
    fi
}

# Main recovery function
main() {
    log "Starting BSC DEX Disaster Recovery"
    log "Recovery mode: ${DR_MODE}"
    log "Backup date: ${BACKUP_DATE}"
    log "Backup location: ${BACKUP_LOCATION}"

    # Send start notification
    send_notification "STARTED" "🚨 BSC DEX Disaster Recovery started - Mode: ${DR_MODE}, Backup: ${BACKUP_DATE}"

    # Perform pre-flight checks
    preflight_checks || {
        log_error "Pre-flight checks failed"
        exit 1
    }

    # Create pre-recovery backup
    create_pre_recovery_backup

    # Stop services
    stop_services

    # Perform recovery based on mode
    case "${DR_MODE}" in
        "full")
            recover_database || exit 1
            recover_cache || exit 1
            recover_files || exit 1
            recover_services || exit 1
            ;;
        "database")
            recover_database || exit 1
            recover_services || exit 1
            ;;
        "cache")
            recover_cache || exit 1
            recover_services || exit 1
            ;;
        "files")
            recover_files || exit 1
            recover_services || exit 1
            ;;
        "services")
            recover_services || exit 1
            ;;
        *)
            log_error "Invalid recovery mode: ${DR_MODE}"
            echo "Usage: $0 [backup_date] [mode]"
            echo "Modes: full, database, cache, files, services"
            exit 1
            ;;
    esac

    # Perform health checks
    health_checks || {
        log_error "Health checks failed"
        send_notification "FAILED" "❌ BSC DEX Disaster Recovery FAILED - Health checks did not pass"
        exit 1
    }

    # Perform post-recovery validation
    post_recovery_validation || {
        log_warning "Post-recovery validation had issues, but recovery completed"
    }

    # Send success notification
    send_notification "COMPLETED" "✅ BSC DEX Disaster Recovery COMPLETED successfully - Mode: ${DR_MODE}"

    log_success "Disaster recovery completed successfully! 🎉"
    log "System is ready for use"

    # Display recovery summary
    echo ""
    echo "=== RECOVERY SUMMARY ==="
    echo "Recovery Mode: ${DR_MODE}"
    echo "Backup Date: ${BACKUP_DATE}"
    echo "Recovery Time: $(date)"
    echo "Log File: ${LOG_FILE}"
    echo "========================="
    echo ""
    echo "Next Steps:"
    echo "1. Monitor system performance"
    echo "2. Verify all functionalities"
    echo "3. Check user access"
    echo "4. Monitor error rates"
    echo "5. Update incident documentation"
}

# Script usage
usage() {
    echo "BSC DEX Disaster Recovery Script"
    echo ""
    echo "Usage: $0 [backup_date] [recovery_mode]"
    echo ""
    echo "Arguments:"
    echo "  backup_date    Date of backup to restore (YYYYMMDD, default: today)"
    echo "  recovery_mode  Type of recovery to perform:"
    echo "                 full      - Complete system recovery (default)"
    echo "                 database  - Database recovery only"
    echo "                 cache     - Cache recovery only"
    echo "                 files     - File storage recovery only"
    echo "                 services  - Service restart only"
    echo ""
    echo "Examples:"
    echo "  $0                           # Full recovery from today's backup"
    echo "  $0 20251104                  # Full recovery from specific date"
    echo "  $0 20251104 database         # Database recovery only"
    echo "  $0 20251104 cache            # Cache recovery only"
    echo ""
    echo "Environment Variables:"
    echo "  SLACK_WEBHOOK_URL           Slack webhook for notifications"
    echo "  NOTIFICATION_EMAIL          Email address for notifications"
    echo "  BACKUP_BUCKET               S3 bucket name for backups"
    echo ""
    echo "Log file: ${LOG_FILE}"
}

# Handle script arguments
case "${1:-}" in
    -h|--help)
        usage
        exit 0
        ;;
    --version)
        echo "BSC DEX Disaster Recovery Script v1.0"
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac