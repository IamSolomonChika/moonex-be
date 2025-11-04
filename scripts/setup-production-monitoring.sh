#!/bin/bash

# BSC DEX Integration Platform - Production Monitoring Setup Script
# This script sets up comprehensive production monitoring and alerting

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="bsc-dex"
DOMAIN="bsc-dex.com"
GRAFANA_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD:-$(openssl rand -base64 32)}
SLACK_WEBHOOK_URL=${SLACK_WEBHOOK_URL:-""}
PAGERDUTY_SERVICE_KEY=${PAGERDUTY_SERVICE_KEY:-""}
NOTIFICATION_EMAIL=${NOTIFICATION_EMAIL:-"monitoring@bsc-dex.com"}

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

    # Check if running in production directory
    if [[ ! -f "docker-compose.prod.yml" ]]; then
        log_error "docker-compose.prod.yml not found. Please run from project root."
        exit 1
    fi

    # Check required directories
    for dir in "monitoring" "monitoring/grafana/dashboards" "monitoring/grafana/datasources" "monitoring/prometheus" "monitoring/alertmanager"; do
        if [[ ! -d "$dir" ]]; then
            log_error "Directory $dir not found. Please ensure monitoring structure is in place."
            exit 1
        fi
    done

    log_success "Prerequisites check completed"
}

# Create monitoring environment variables
create_monitoring_env() {
    log "Creating monitoring environment configuration..."

    cat > .env.monitoring << EOF
# Monitoring Configuration
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD}
GRAFANA_DOMAIN=grafana.${DOMAIN}

# Prometheus Configuration
PROMETHEUS_DOMAIN=prometheus.${DOMAIN}
PROMETHEUS_RETENTION=30d

# Alertmanager Configuration
ALERTMANAGER_DOMAIN=alertmanager.${DOMAIN}

# Notification Configuration
SLACK_WEBHOOK_URL=${SLACK_WEBHOOK_URL}
PAGERDUTY_SERVICE_KEY=${PAGERDUTY_SERVICE_KEY}
NOTIFICATION_EMAIL=${NOTIFICATION_EMAIL}

# Security
MONITORING_BASIC_AUTH_USERNAME=monitoring
MONITORING_BASIC_AUTH_PASSWORD=$(openssl rand -base64 32)

# Storage
PROMETHEUS_STORAGE_SIZE=20Gi
GRAFANA_STORAGE_SIZE=5Gi
EOF

    log_success "Monitoring environment configuration created"
}

# Setup Prometheus configuration
setup_prometheus() {
    log "Setting up Prometheus configuration..."

    # Create additional Prometheus configuration
    cat > monitoring/prometheus-additional.yml << EOF
# Additional Prometheus Configuration
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "alert_rules.yml"
  - "recording_rules.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093

scrape_configs:
  # Application metrics
  - job_name: 'bsc-dex-api'
    static_configs:
      - targets: ['api:3000']
    metrics_path: '/metrics'
    scrape_interval: 30s

  # Background worker metrics
  - job_name: 'bsc-dex-worker'
    static_configs:
      - targets: ['worker:3000']
    metrics_path: '/metrics'
    scrape_interval: 30s

  # PostgreSQL metrics
  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']
    scrape_interval: 30s

  # Redis metrics
  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']
    scrape_interval: 30s

  # Nginx metrics
  - job_name: 'nginx'
    static_configs:
      - targets: ['nginx-exporter:9113']
    scrape_interval: 30s

  # Node exporter metrics
  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']
    scrape_interval: 30s

  # Blackbox exporter for external checks
  - job_name: 'blackbox'
    metrics_path: /probe
    params:
      module: [http_2xx]
    static_configs:
      - targets:
        - https://api.${DOMAIN}/health
        - https://bsc-dataseed1.binance.org/
        - https://api.pancakeswap.info/api/v2/tokens
    relabel_configs:
      - source_labels: [__address__]
        target_label: __param_target
      - source_labels: [__param_target]
        target_label: instance
      - target_label: __address__
        replacement: blackbox-exporter:9115

  # Docker container metrics
  - job_name: 'docker'
    static_configs:
      - targets: ['docker-exporter:9323']
    scrape_interval: 30s
EOF

    log_success "Prometheus configuration completed"
}

# Setup Grafana datasources
setup_grafana_datasources() {
    log "Setting up Grafana datasources..."

    cat > monitoring/grafana/datasources/bsc-dex-datasources.yml << EOF
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: true
    jsonData:
      timeInterval: "15s"
      queryTimeout: "60s"
    secureJsonData: {}

  - name: BSC DEX Logs
    type: loki
    access: proxy
    url: http://loki:3100
    editable: true
    jsonData:
      maxLines: 1000
    secureJsonData: {}

  - name: PostgreSQL
    type: postgres
    access: proxy
    url: postgres:5432
    database: bsc_dex
    user: bsc_dex_user
    secureJsonData:
      password: \${POSTGRES_PASSWORD}
    jsonData:
      sslmode: "disable"

  - name: Redis
    type: redis
    access: proxy
    url: redis:6379
    secureJsonData:
      password: \${REDIS_PASSWORD}
    jsonData:
      client: "advanced"
      poolSize: 10
      timeout: 10
EOF

    log_success "Grafana datasources configured"
}

# Setup production alert rules
setup_production_alerts() {
    log "Setting up production alert rules..."

    cat > monitoring/alert_rules-production.yml << EOF
# Production Alert Rules for BSC DEX Platform
groups:
  - name: production_critical_alerts
    rules:
      # System critical alerts
      - alert: ServiceDown
        expr: up == 0
        for: 1m
        labels:
          severity: critical
          service: "{{ .labels.job }}"
        annotations:
          summary: "{{ .labels.job }} service is down"
          description: "{{ .labels.job }} has been down for more than 1 minute."

      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) * 100 > 5
        for: 2m
        labels:
          severity: critical
          service: api
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }}% for the last 5 minutes."

      - alert: DatabaseConnectionFailure
        expr: up{job="postgres"} == 0
        for: 1m
        labels:
          severity: critical
          service: database
        annotations:
          summary: "Database connection failure"
          description: "Cannot connect to PostgreSQL database."

      - alert: TradingSystemFailure
        expr: rate(trading_success_total[5m]) / rate(trading_attempts_total[5m]) < 0.9
        for: 3m
        labels:
          severity: critical
          service: trading
        annotations:
          summary: "Trading system failure detected"
          description: "Trading success rate is {{ $value | humanizePercentage }}"

  - name: production_warning_alerts
    rules:
      # Performance warnings
      - alert: HighResponseTime
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
        for: 5m
        labels:
          severity: warning
          service: api
        annotations:
          summary: "High API response time"
          description: "95th percentile response time is {{ $value }} seconds."

      - alert: HighResourceUsage
        expr: 100 - (avg by(instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 80
        for: 5m
        labels:
          severity: warning
          service: system
        annotations:
          summary: "High CPU usage"
          description: "CPU usage is {{ $value }}% on {{ .labels.instance }}."

      - alert: HighMemoryUsage
        expr: (node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes * 100 > 80
        for: 5m
        labels:
          severity: warning
          service: system
        annotations:
          summary: "High memory usage"
          description: "Memory usage is {{ $value }}% on {{ .labels.instance }}."

      - alert: LowTradingVolume
        expr: rate(trading_volume_usd_total[1h]) < 100
        for: 30m
        labels:
          severity: warning
          service: business
        annotations:
          summary: "Low trading volume"
          description: "Trading volume is {{ $value }} USD in the last hour."

  - name: blockchain_alerts
    rules:
      # BSC network alerts
      - alert: BSCNodeDown
        expr: up{job="bsc-node"} == 0
        for: 2m
        labels:
          severity: critical
          service: blockchain
        annotations:
          summary: "BSC node is down"
          description: "Cannot connect to BSC node."

      - alert: HighGasPrice
        expr: bsc_gas_price > 20000000000
        for: 10m
        labels:
          severity: warning
          service: blockchain
        annotations:
          summary: "High BSC gas price"
          description: "BSC gas price is {{ $value | humanizeGwei }} Gwei."

      - alert: MEVProtectionFailure
        expr: mev_protection_success_rate < 95
        for: 5m
        labels:
          severity: warning
          service: security
        annotations:
          summary: "MEV protection failure"
          description: "MEV protection success rate is {{ $value }}%."
EOF

    log_success "Production alert rules configured"
}

# Setup production Alertmanager configuration
setup_alertmanager() {
    log "Setting up Alertmanager configuration..."

    cat > monitoring/alertmanager/production-alertmanager.yml << EOF
# Production Alertmanager Configuration
global:
  smtp_smarthost: 'smtp.sendgrid.net:587'
  smtp_from: 'alerts@bsc-dex.com'
  smtp_auth_username: 'apikey'
  smtp_auth_password: 'YOUR_SENDGRID_API_KEY'

route:
  group_by: ['alertname', 'cluster', 'service']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  receiver: 'default'
  routes:
    # Critical alerts
    - match:
        severity: critical
      group_wait: 5s
      repeat_interval: 5m
      receiver: 'critical-alerts'
      routes:
        - match:
            service: trading
          receiver: 'trading-critical'
        - match:
            service: database
          receiver: 'database-critical'
        - match:
            service: blockchain
          receiver: 'blockchain-critical'

    # Warning alerts
    - match:
        severity: warning
      group_wait: 30s
      repeat_interval: 2h
      receiver: 'warning-alerts'

    # Business alerts
    - match:
        service: business
      receiver: 'business-alerts'

receivers:
  - name: 'default'
    slack_configs:
      - api_url: '${SLACK_WEBHOOK_URL}'
        channel: '#alerts'
        title: 'BSC DEX Alert'
        text: '{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'
        send_resolved: true

  - name: 'critical-alerts'
    slack_configs:
      - api_url: '${SLACK_WEBHOOK_URL}'
        channel: '#critical-alerts'
        title: '🚨 CRITICAL ALERT'
        text: |
          *Alert*: {{ .GroupLabels.alertname }}
          *Severity*: {{ .GroupLabels.severity }}
          *Service*: {{ .GroupLabels.service }}

          {{ range .Alerts }}
          *Description*: {{ .Annotations.description }}
          *Runbook*: {{ .Annotations.runbook_url }}
          {{ end }}
        color: 'danger'
        send_resolved: true
    email_configs:
      - to: 'oncall@bsc-dex.com,devops@bsc-dex.com'
        subject: '[CRITICAL] BSC DEX Alert: {{ .GroupLabels.alertname }}'
        body: |
          You are receiving this email because a critical alert has been triggered.

          Alert: {{ .GroupLabels.alertname }}
          Severity: {{ .GroupLabels.severity }}
          Service: {{ .GroupLabels.service }}

          {{ range .Alerts }}
          Description: {{ .Annotations.description }}
          Instance: {{ .Labels.instance }}
          Time: {{ .StartsAt }}
          {{ end }}

          Please investigate immediately.
    pagerduty_configs:
      - service_key: '${PAGERDUTY_SERVICE_KEY}'
        description: '{{ .GroupLabels.alertname }}: {{ .Annotations.summary }}'

  - name: 'trading-critical'
    slack_configs:
      - api_url: '${SLACK_WEBHOOK_URL}'
        channel: '#trading-alerts'
        title: '💰 TRADING CRITICAL'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
        color: 'danger'
        send_resolved: true
    email_configs:
      - to: 'trading-team@bsc-dex.com,devops@bsc-dex.com'

  - name: 'database-critical'
    slack_configs:
      - api_url: '${SLACK_WEBHOOK_URL}'
        channel: '#database-alerts'
        title: '🗄️ DATABASE CRITICAL'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
        color: 'danger'
        send_resolved: true
    email_configs:
      - to: 'dba@bsc-dex.com,infra@bsc-dex.com'

  - name: 'blockchain-critical'
    slack_configs:
      - api_url: '${SLACK_WEBHOOK_URL}'
        channel: '#blockchain-alerts'
        title: '⛓️ BLOCKCHAIN CRITICAL'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
        color: 'danger'
        send_resolved: true
    email_configs:
      - to: 'blockchain-team@bsc-dex.com,infra@bsc-dex.com'

  - name: 'warning-alerts'
    slack_configs:
      - api_url: '${SLACK_WEBHOOK_URL}'
        channel: '#alerts'
        title: '⚠️ WARNING'
        text: '{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'
        color: 'warning'
        send_resolved: true
    email_configs:
      - to: 'devops@bsc-dex.com'
        subject: '[WARNING] BSC DEX Alert: {{ .GroupLabels.alertname }}'

  - name: 'business-alerts'
    slack_configs:
      - api_url: '${SLACK_WEBHOOK_URL}'
        channel: '#business-alerts'
        title: '💰 BUSINESS ALERT'
        text: '{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'
        color: 'warning'
        send_resolved: true
    email_configs:
      - to: 'business@bsc-dex.com,product@bsc-dex.com'

inhibit_rules:
  # Inhibit warning alerts if critical alert is firing for same instance
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['instance']

  # Inhibit node alerts if instance is down
  - source_match:
      alertname: 'InstanceDown'
    target_match_re:
      alertname: '(HighCPUUsage|HighMemoryUsage|DiskSpaceLow)'
    equal: ['instance']
EOF

    log_success "Alertmanager configuration completed"
}

# Update production Docker Compose
update_docker_compose() {
    log "Updating Docker Compose for production monitoring..."

    # Backup existing docker-compose.prod.yml
    cp docker-compose.prod.yml docker-compose.prod.yml.backup

    # Add monitoring services to docker-compose.prod.yml
    cat >> docker-compose.prod.yml << 'EOF'

  # Production Monitoring Services
  node-exporter:
    image: prom/node-exporter:latest
    container_name: bsc-dex-node-exporter
    restart: unless-stopped
    ports:
      - "9100:9100"
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    command:
      - '--path.procfs=/host/proc'
      - '--path.rootfs=/rootfs'
      - '--path.sysfs=/host/sys'
      - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)'
    networks:
      - bsc-dex-network

  postgres-exporter:
    image: prometheuscommunity/postgres-exporter:latest
    container_name: bsc-dex-postgres-exporter
    restart: unless-stopped
    environment:
      DATA_SOURCE_NAME: "postgresql://bsc_dex_user:${POSTGRES_PASSWORD}@postgres:5432/bsc_dex?sslmode=disable"
    ports:
      - "9187:9187"
    depends_on:
      - postgres
    networks:
      - bsc-dex-network

  redis-exporter:
    image: oliver006/redis_exporter:latest
    container_name: bsc-dex-redis-exporter
    restart: unless-stopped
    environment:
      REDIS_ADDR: "redis://redis:6379"
      REDIS_PASSWORD: "${REDIS_PASSWORD}"
    ports:
      - "9121:9121"
    depends_on:
      - redis
    networks:
      - bsc-dex-network

  nginx-exporter:
    image: nginx/nginx-prometheus-exporter:latest
    container_name: bsc-dex-nginx-exporter
    restart: unless-stopped
    command:
      - '-nginx.scrape-uri=http://nginx:8080/nginx_status'
    ports:
      - "9113:9113"
    depends_on:
      - nginx
    networks:
      - bsc-dex-network

  docker-exporter:
    image: prometheuscommunity/docker-exporter:latest
    container_name: bsc-dex-docker-exporter
    restart: unless-stopped
    environment:
      DOCKER_HOST: unix:///var/run/docker.sock
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    ports:
      - "9323:9323"
    networks:
      - bsc-dex-network

  blackbox-exporter:
    image: prom/blackbox-exporter:latest
    container_name: bsc-dex-blackbox-exporter
    restart: unless-stopped
    volumes:
      - ./monitoring/blackbox.yml:/etc/blackbox_exporter/config.yml
    ports:
      - "9115:9115"
    networks:
      - bsc-dex-network
EOF

    log_success "Docker Compose updated with monitoring services"
}

# Setup monitoring authentication
setup_monitoring_auth() {
    log "Setting up monitoring authentication..."

    # Create Nginx configuration for monitoring
    mkdir -p nginx/monitoring

    cat > nginx/monitoring/monitoring-auth.conf << 'EOF'
# Monitoring Authentication Configuration
auth_basic "Restricted Area";
auth_basic_user_file /etc/nginx/.htpasswd;

# Allow health checks without authentication
location /health {
    auth_basic off;
    allow all;
}

# Restrict access by IP for internal networks
allow 10.0.0.0/8;
allow 172.16.0.0/12;
allow 192.168.0.0/16;
deny all;
EOF

    # Generate htpasswd file
    if command -v htpasswd &> /dev/null; then
        htpasswd -cb nginx/.htpasswd $MONITORING_BASIC_AUTH_USERNAME $MONITORING_BASIC_AUTH_PASSWORD
    else
        # Fallback using docker
        docker run --rm -it httpd:alpine htpasswd -cb $MONITORING_BASIC_AUTH_USERNAME $MONITORING_BASIC_AUTH_PASSWORD > nginx/.htpasswd
    fi

    log_success "Monitoring authentication configured"
}

# Start monitoring services
start_monitoring() {
    log "Starting monitoring services..."

    # Load environment variables
    source .env.monitoring

    # Start additional monitoring services
    docker-compose -f docker-compose.prod.yml up -d \
        node-exporter \
        postgres-exporter \
        redis-exporter \
        nginx-exporter \
        docker-exporter \
        blackbox-exporter

    # Wait for services to start
    sleep 10

    # Configure Prometheus
    docker-compose -f docker-compose.prod.yml exec prometheus promtool check config /etc/prometheus/prometheus.yml

    # Reload Prometheus configuration
    curl -X POST http://localhost:9090/-/reload

    # Configure Alertmanager
    docker-compose -f docker-compose.prod.yml exec alertmanager amtool check-config /etc/alertmanager/alertmanager.yml

    # Reload Alertmanager configuration
    curl -X POST http://localhost:9093/-/reload

    log_success "Monitoring services started and configured"
}

# Verify monitoring setup
verify_monitoring() {
    log "Verifying monitoring setup..."

    # Check Prometheus
    if curl -f http://localhost:9090/-/healthy &>/dev/null; then
        log_success "Prometheus is healthy"
    else
        log_error "Prometheus health check failed"
        return 1
    fi

    # Check Grafana
    if curl -f http://localhost:3001/api/health &>/dev/null; then
        log_success "Grafana is healthy"
    else
        log_error "Grafana health check failed"
        return 1
    fi

    # Check Alertmanager
    if curl -f http://localhost:9093/-/healthy &>/dev/null; then
        log_success "Alertmanager is healthy"
    else
        log_error "Alertmanager health check failed"
        return 1
    fi

    # Check exporters
    local exporters=("node-exporter:9100" "postgres-exporter:9187" "redis-exporter:9121")
    for exporter in "${exporters[@]}"; do
        if curl -f "http://localhost:${exporter#*:}/metrics" &>/dev/null; then
            log_success "${exporter%:*} is responding"
        else
            log_warning "${exporter%:*} is not responding"
        fi
    done

    log_success "Monitoring verification completed"
}

# Display setup summary
display_summary() {
    log "Production monitoring setup completed! 🎉"
    echo ""
    echo "=== MONITORING SETUP SUMMARY ==="
    echo "Grafana URL: http://localhost:3001"
    echo "Grafana Username: admin"
    echo "Grafana Password: ${GRAFANA_ADMIN_PASSWORD}"
    echo ""
    echo "Prometheus URL: http://localhost:9090"
    echo "Alertmanager URL: http://localhost:9093"
    echo ""
    echo "Monitoring Auth Username: ${MONITORING_BASIC_AUTH_USERNAME}"
    echo "Monitoring Auth Password: ${MONITORING_BASIC_AUTH_PASSWORD}"
    echo ""
    echo "Configuration Files:"
    echo "- Monitoring Environment: .env.monitoring"
    echo "- Prometheus Config: monitoring/prometheus-additional.yml"
    echo "- Alert Rules: monitoring/alert_rules-production.yml"
    echo "- Alertmanager Config: monitoring/alertmanager/production-alertmanager.yml"
    echo "- Grafana Datasources: monitoring/grafana/datasources/bsc-dex-datasources.yml"
    echo ""
    echo "Next Steps:"
    echo "1. Configure Slack webhook URL (.env.monitoring)"
    echo "2. Configure PagerDuty service key (.env.monitoring)"
    echo "3. Update notification email (.env.monitoring)"
    echo "4. Import Grafana dashboards"
    echo "5. Test alert routing"
    echo "6. Monitor system performance"
    echo "================================="
}

# Main setup function
main() {
    log "Starting BSC DEX Production Monitoring Setup"

    check_prerequisites
    create_monitoring_env
    setup_prometheus
    setup_grafana_datasources
    setup_production_alerts
    setup_alertmanager
    update_docker_compose
    setup_monitoring_auth
    start_monitoring
    verify_monitoring
    display_summary

    log_success "Production monitoring setup completed! 🚀"
}

# Script usage
usage() {
    echo "BSC DEX Production Monitoring Setup Script"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  -h, --help                  Show this help message"
    echo "  --verify-only              Only verify existing setup"
    echo "  --config-only              Only generate configuration files"
    echo ""
    echo "Environment Variables:"
    echo "  GRAFANA_ADMIN_PASSWORD      Grafana admin password (auto-generated if not set)"
    echo "  SLACK_WEBHOOK_URL          Slack webhook for notifications"
    echo "  PAGERDUTY_SERVICE_KEY      PagerDuty service key for critical alerts"
    echo "  NOTIFICATION_EMAIL         Email address for notifications"
    echo ""
    echo "Examples:"
    echo "  $0                         # Full monitoring setup"
    echo "  $0 --verify-only           # Verify existing setup only"
    echo "  $0 --config-only           # Generate configuration only"
    echo ""
    echo "After setup:"
    echo "1. Access Grafana at http://localhost:3001"
    echo "2. Import dashboards from monitoring/grafana/dashboards/"
    echo "3. Configure notification channels"
    echo "4. Test alert routing"
}

# Handle script arguments
case "${1:-}" in
    -h|--help)
        usage
        exit 0
        ;;
    --verify-only)
        check_prerequisites
        verify_monitoring
        exit 0
        ;;
    --config-only)
        check_prerequisites
        create_monitoring_env
        setup_prometheus
        setup_grafana_datasources
        setup_production_alerts
        setup_alertmanager
        display_summary
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac