# BSC DEX Integration Platform - Monitoring and Alerting Setup

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Components](#components)
4. [Installation](#installation)
5. [Configuration](#configuration)
6. [Dashboards](#dashboards)
7. [Alerts](#alerts)
8. [Maintenance](#maintenance)
9. [Troubleshooting](#troubleshooting)

## Overview

The BSC DEX Integration Platform includes comprehensive monitoring and alerting infrastructure to ensure high availability, performance optimization, and proactive issue detection. The monitoring stack is built on industry-standard tools:

- **Prometheus**: Metrics collection and storage
- **Grafana**: Visualization and dashboards
- **Alertmanager**: Alert routing and notification
- **Node Exporter**: System metrics
- **Various Exporters**: Application and infrastructure metrics

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Applications  │    │   Exporters     │    │   Services      │
│                 │    │                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │ API Service │ │    │ │ Node Export │ │    │ │ Prometheus  │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │   Worker    │ │    │ │PostgreSQL   │ │    │ │ Alertmanager│ │
│ └─────────────┘ │    │ │  Exporter   │ │    │ └─────────────┘ │
│ ┌─────────────┐ │    │ └─────────────┘ │    │ ┌─────────────┐ │
│ │WebSocket Svc│ │    │ ┌─────────────┐ │    │ │   Grafana   │ │
│ └─────────────┘ │    │ │ Redis       │ │    │ └─────────────┘ │
└─────────────────┘    │ │ Exporter   │ │    └─────────────────┘
                       │ └─────────────┘ │
                       │ ┌─────────────┐ │
                       │ │Blackbox     │ │
                       │ │ Exporter    │ │
                       │ └─────────────┘ │
                       └─────────────────┘
                                │
                        ┌───────▼───────┐
                        │   Metrics     │
                        │   Collection  │
                        └───────────────┘
```

## Components

### 1. Prometheus

Prometheus is the core metrics collection and storage system. It scrapes metrics from various exporters and stores them for querying and alerting.

**Key Features:**
- Multi-dimensional data model
- Powerful query language (PromQL)
- Efficient time-series storage
- Built-in alerting
- Service discovery

### 2. Grafana

Grafana provides visualization capabilities through customizable dashboards.

**Key Features:**
- Rich visualization options
- Dashboard templating
- Multiple data source support
- Alert integration
- User management

### 3. Alertmanager

Alertmanager handles alert routing, grouping, and notification delivery.

**Key Features:**
- Alert grouping and inhibition
- Multiple notification channels
- Alert routing based on labels
- Silencing and suppression
- High availability

### 4. Exporters

#### Node Exporter
Collects system-level metrics:
- CPU usage
- Memory usage
- Disk I/O and space
- Network statistics
- Filesystem information

#### PostgreSQL Exporter
Collects database metrics:
- Connection counts
- Query performance
- Database size
- Lock information
- Replication lag

#### Redis Exporter
Collects Redis metrics:
- Memory usage
- Connection counts
- Command statistics
- Hit rates
- Key distribution

#### Blackbox Exporter
Performs external probes:
- HTTP endpoint checks
- SSL certificate monitoring
- DNS resolution checks
- TCP connectivity tests

## Installation

### 1. Prerequisites

Ensure you have Docker and Docker Compose installed on your system.

### 2. Monitoring Stack Deployment

The monitoring components are included in the main `docker-compose.prod.yml` file:

```yaml
# Prometheus
prometheus:
  image: prom/prometheus:latest
  container_name: bsc-dex-prometheus
  volumes:
    - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
    - ./monitoring/alert_rules.yml:/etc/prometheus/alert_rules.yml
    - ./monitoring/recording_rules.yml:/etc/prometheus/recording_rules.yml
    - prometheus_data:/prometheus

# Grafana
grafana:
  image: grafana/grafana:latest
  container_name: bsc-dex-grafana
  volumes:
    - ./monitoring/grafana/datasources:/etc/grafana/provisioning/datasources
    - ./monitoring/grafana/dashboards:/etc/grafana/provisioning/dashboards

# Alertmanager
alertmanager:
  image: prom/alertmanager:latest
  container_name: bsc-dex-alertmanager
  volumes:
    - ./monitoring/alertmanager/alertmanager.yml:/etc/alertmanager/alertmanager.yml
```

### 3. Start Monitoring Services

```bash
# Start all services including monitoring
docker-compose -f docker-compose.prod.yml up -d

# Start only monitoring services
docker-compose -f docker-compose.prod.yml up -d prometheus grafana alertmanager
```

### 4. Verify Installation

```bash
# Check Prometheus
curl http://localhost:9090/-/healthy

# Check Grafana
curl http://localhost:3001/api/health

# Check Alertmanager
curl http://localhost:9093/-/healthy
```

## Configuration

### 1. Prometheus Configuration

Edit `monitoring/prometheus.yml` to customize:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "alert_rules.yml"
  - "recording_rules.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']

scrape_configs:
  # Add your custom scrape jobs here
  - job_name: 'custom-service'
    static_configs:
      - targets: ['service:port']
```

### 2. Alertmanager Configuration

Edit `monitoring/alertmanager/alertmanager.yml` to configure notification channels:

```yaml
global:
  smtp_smarthost: 'smtp.sendgrid.net:587'
  smtp_from: 'alerts@bsc-dex.com'

receivers:
  - name: 'critical-alerts'
    slack_configs:
      - api_url: 'YOUR_SLACK_WEBHOOK_URL'
        channel: '#critical-alerts'
    email_configs:
      - to: 'team@bsc-dex.com'
```

### 3. Grafana Configuration

Data sources are automatically provisioned from `monitoring/grafana/datasources/`. Dashboards are loaded from `monitoring/grafana/dashboards/`.

## Dashboards

### 1. Overview Dashboard

The main dashboard provides a high-level view of the system:

- API request rate and error rates
- Response time percentiles
- System status indicators
- BSC gas price monitoring
- Trading volume statistics
- Database connection counts
- MEV protection success rates

**Access:** `https://your-domain:3001/d/bsc-dex-overview`

### 2. System Monitoring Dashboard

Detailed system metrics:

- CPU, memory, disk usage
- Network I/O statistics
- Container resource usage
- System load averages

### 3. Application Dashboard

Application-specific metrics:

- HTTP request metrics
- Business KPIs
- Error rates and patterns
- User activity metrics

### 4. Database Dashboard

Database performance metrics:

- Connection pool usage
- Query performance
- Database size growth
- Lock statistics

### 5. Blockchain Dashboard

Blockchain-related metrics:

- BSC node sync status
- Gas price trends
- Transaction success rates
- MEV protection metrics

## Alerts

### Alert Categories

#### System Alerts
- **High CPU Usage**: CPU > 80% for 5 minutes
- **High Memory Usage**: Memory > 85% for 5 minutes
- **Disk Space Low**: Disk < 15% free for 10 minutes
- **Instance Down**: Service unreachable for 1 minute

#### Application Alerts
- **API Service Down**: API unreachable for 2 minutes
- **High Response Time**: 95th percentile > 2 seconds for 5 minutes
- **High Error Rate**: 5xx errors > 5% for 3 minutes
- **Database Connection Failure**: Database unreachable for 2 minutes

#### Business Alerts
- **Low Trading Volume**: Volume < $1000/hour for 30 minutes
- **Failed Transaction Spike**: Failure rate > 10% for 5 minutes
- **MEV Protection Failure**: Success rate < 95% for 10 minutes

#### Security Alerts
- **High Failed Auth Rate**: > 10 failed attempts/second
- **Suspicious API Usage**: > 1000 requests/second from single IP
- **SSL Certificate Expiring**: Certificate expires in 30 days

### Alert Severities

- **Critical**: Immediate attention required (paged)
- **Warning**: Investigate within business hours
- **Info**: For awareness only

### Notification Channels

#### Slack Integration
```yaml
slack_configs:
  - api_url: 'YOUR_SLACK_WEBHOOK_URL'
    channel: '#alerts'
    title: 'BSC DEX Alert'
    send_resolved: true
```

#### Email Integration
```yaml
email_configs:
  - to: 'team@bsc-dex.com'
    subject: '[ALERT] {{ .GroupLabels.alertname }}'
    body: |
      Alert: {{ .GroupLabels.alertname }}
      Description: {{ .Annotations.description }}
```

#### PagerDuty Integration
```yaml
pagerduty_configs:
  - service_key: 'YOUR_PAGERDUTY_SERVICE_KEY'
    description: '{{ .GroupLabels.alertname }}'
```

## Maintenance

### 1. Monitoring Data Retention

Configure data retention in Prometheus:

```yaml
# In prometheus.yml
storage:
  tsdb:
    retention.time: 30d
    retention.size: 10GB
```

### 2. Backup Configuration

Regularly backup monitoring configurations:

```bash
# Backup Prometheus data
docker exec prometheus tar -czf /tmp/prometheus-data.tar.gz /prometheus

# Backup Grafana data
docker exec grafana tar -czf /tmp/grafana-data.tar.gz /var/lib/grafana
```

### 3. Log Management

Monitor monitoring component logs:

```bash
# View Prometheus logs
docker-compose logs -f prometheus

# View Alertmanager logs
docker-compose logs -f alertmanager

# View Grafana logs
docker-compose logs -f grafana
```

### 4. Performance Tuning

#### Prometheus Optimization
```yaml
# Adjust scrape intervals
scrape_interval: 30s  # Increase from 15s

# Configure remote write for long-term storage
remote_write:
  - url: "https://long-term-storage/api/v1/write"
```

#### Grafana Optimization
- Use dashboard refresh intervals wisely
- Optimize queries for performance
- Use query caching when appropriate

## Troubleshooting

### Common Issues

#### 1. Prometheus Not Scraping Metrics

**Symptoms:** No data in Prometheus dashboards

**Solutions:**
```bash
# Check Prometheus configuration
docker exec prometheus promtool check config /etc/prometheus/prometheus.yml

# Check target status
curl http://localhost:9090/api/v1/targets

# Check metrics endpoint
curl http://api-service:3000/metrics
```

#### 2. Grafana Data Source Issues

**Symptoms:** Dashboards show no data

**Solutions:**
```bash
# Check Grafana data sources
curl -u admin:password http://localhost:3001/api/datasources

# Test data source connection
curl -u admin:password http://localhost:3001/api/datasources/proxy/1/api/v1/query?query=up
```

#### 3. Alertmanager Not Sending Alerts

**Symptoms:** Alerts firing but no notifications

**Solutions:**
```bash
# Check Alertmanager configuration
docker exec alertmanager amtool check-config /etc/alertmanager/alertmanager.yml

# Test alert routing
curl -X POST http://localhost:9093/api/v1/alerts -d '[{"labels":{"alertname":"Test"}}]'

# Check Alertmanager logs
docker-compose logs alertmanager
```

#### 4. High Memory Usage

**Symptoms:** Monitoring components using excessive memory

**Solutions:**
```bash
# Check memory usage
docker stats

# Optimize Prometheus storage
# Edit docker-compose.prod.yml
command:
  - '--storage.tsdb.retention.time=15d'
  - '--storage.tsdb.wal-compression'
```

### Performance Issues

#### 1. Slow Queries

**Symptoms:** Grafana dashboards loading slowly

**Solutions:**
- Optimize PromQL queries
- Use recording rules for complex queries
- Increase query timeout
- Use dashboard caching

#### 2. High CPU Usage

**Symptoms:** Monitoring components consuming high CPU

**Solutions:**
- Increase scrape intervals
- Reduce number of metrics collected
- Use metric filtering
- Scale monitoring components

## Security Considerations

### 1. Access Control

- Enable authentication in Grafana
- Use firewall rules to restrict access
- Implement network segmentation
- Use HTTPS for all web interfaces

### 2. Data Protection

- Encrypt data at rest and in transit
- Regularly rotate API keys and secrets
- Implement backup encryption
- Monitor for unauthorized access

### 3. Secure Configuration

```yaml
# Grafana security
admin_user: admin
admin_password: secure_password
auth.basic.enabled: true

# Prometheus basic auth
basic_auth_users:
  admin: $2b$12$encrypted_password_hash
```

## Scaling Considerations

### 1. High Availability

Deploy monitoring components in HA mode:

```yaml
# Prometheus HA
prometheus-1:
  image: prom/prometheus:latest
prometheus-2:
  image: prom/prometheus:latest

# Alertmanager HA
alertmanager-1:
  image: prom/alertmanager:latest
alertmanager-2:
  image: prom/alertmanager:latest
```

### 2. Remote Storage

Use remote storage for long-term data retention:

```yaml
remote_write:
  - url: "https://cortex/api/v1/push"
    basic_auth:
      username: your-username
      password: your-password
```

### 3. Federation

Implement Prometheus federation for large-scale deployments:

```yaml
# Global Prometheus
scrape_configs:
  - job_name: 'federate'
    scrape_interval: 15s
    honor_labels: true
    metrics_path: /federate
    params:
      'match[]':
        - '{__name__=~"job:.*"}'
    static_configs:
      - targets: ['prometheus-1:9090', 'prometheus-2:9090']
```

## Best Practices

### 1. Metric Naming
- Use consistent naming conventions
- Include units in metric names
- Use labels for dimensional data
- Document metric definitions

### 2. Alert Design
- Set meaningful thresholds
- Include actionable information
- Use appropriate severity levels
- Document alert procedures

### 3. Dashboard Design
- Focus on actionable metrics
- Use consistent layouts
- Include context and annotations
- Optimize for performance

### 4. Documentation
- Document alert runbooks
- Maintain metric dictionaries
- Document architecture decisions
- Keep configuration in version control

---

For more information, refer to the official documentation:
- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Alertmanager Documentation](https://prometheus.io/docs/alerting/latest/alertmanager/)