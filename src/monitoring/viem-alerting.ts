/**
 * 🚨 Viem Alerting System
 *
 * Alerting and notification system for Viem 2.38.5 deployment issues
 * Monitors critical metrics and triggers alerts when thresholds are exceeded
 */

import { EventEmitter } from 'events';
import { getViemMonitor, Metric, HealthCheck } from './viem-monitor';

// Alert types
export enum AlertType {
  METRIC_THRESHOLD = 'metric_threshold',
  HEALTH_DEGRADED = 'health_degraded',
  HEALTH_UNHEALTHY = 'health_unhealthy',
  ERROR_RATE_HIGH = 'error_rate_high',
  PERFORMANCE_DEGRADED = 'performance_degraded',
  BSC_CONNECTIVITY = 'bsc_connectivity',
  MEMORY_HIGH = 'memory_high',
  CUSTOM = 'custom'
}

// Alert severity levels
export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

// Alert interface
export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  details: any;
  timestamp: number;
  acknowledged: boolean;
  resolved: boolean;
  resolvedAt?: number;
}

// Alert rule interface
export interface AlertRule {
  id: string;
  name: string;
  type: AlertType;
  severity: AlertSeverity;
  condition: (metrics: Record<string, Metric>, health: Record<string, HealthCheck>) => boolean;
  message: string;
  details: string;
  enabled: boolean;
  cooldown: number; // Cooldown period in milliseconds
}

// Notification channel interface
export interface NotificationChannel {
  id: string;
  name: string;
  type: 'email' | 'slack' | 'webhook' | 'console';
  config: any;
  enabled: boolean;
}

/**
 * Viem Alerting Class
 */
export class ViemAlerting extends EventEmitter {
  private rules: Map<string, AlertRule> = new Map();
  private channels: Map<string, NotificationChannel> = new Map();
  private alerts: Map<string, Alert> = new Map();
  private alertCooldowns: Map<string, number> = new Map();
  private monitoring: any;

  constructor() {
    super();
    this.monitoring = getViemMonitor();
    this.setupDefaultRules();
    this.setupDefaultChannels();
    this.startMonitoring();
  }

  /**
   * Setup default alert rules
   */
  private setupDefaultRules(): void {
    // BSC connectivity alert
    this.addRule({
      id: 'bsc_connectivity',
      name: 'BSC Connectivity Alert',
      type: AlertType.BSC_CONNECTIVITY,
      severity: AlertSeverity.CRITICAL,
      condition: (metrics, health) => {
        return health.bsc?.status === 'unhealthy';
      },
      message: 'BSC connection is unhealthy',
      details: 'The BSC RPC connection is experiencing issues. This affects all blockchain operations.',
      enabled: true,
      cooldown: 300000 // 5 minutes
    });

    // High memory usage alert
    this.addRule({
      id: 'memory_high',
      name: 'High Memory Usage Alert',
      type: AlertType.MEMORY_HIGH,
      severity: AlertSeverity.WARNING,
      condition: (metrics, health) => {
        const heapUsed = metrics['memory.heap_used'];
        return heapUsed ? heapUsed.value > 1024 * 1024 * 1024 : false; // 1GB threshold
      },
      message: 'Memory usage is high',
      details: 'Application memory usage is above 1GB. Monitor for potential memory leaks.',
      enabled: true,
      cooldown: 600000 // 10 minutes
    });

    // BSC latency alert
    this.addRule({
      id: 'bsc_latency',
      name: 'BSC Latency Alert',
      type: AlertType.PERFORMANCE_DEGRADED,
      severity: AlertSeverity.WARNING,
      condition: (metrics, health) => {
        const latency = metrics['bsc.latency'];
        return latency ? latency.value > 2000 : false; // 2 seconds threshold
      },
      message: 'BSC RPC latency is high',
      details: 'BSC RPC response time is above 2 seconds. This may affect user experience.',
      enabled: true,
      cooldown: 300000 // 5 minutes
    });

    // Event loop lag alert
    this.addRule({
      id: 'event_loop_lag',
      name: 'Event Loop Lag Alert',
      type: AlertType.PERFORMANCE_DEGRADED,
      severity: AlertSeverity.ERROR,
      condition: (metrics, health) => {
        const lag = metrics['performance.event_loop_lag'];
        return lag ? lag.value > 500 : false; // 500ms threshold
      },
      message: 'Event loop lag is high',
      details: 'Event loop lag is above 500ms. The application may be experiencing performance issues.',
      enabled: true,
      cooldown: 300000 // 5 minutes
    });

    // Health degraded alert
    this.addRule({
      id: 'health_degraded',
      name: 'Health Status Degraded Alert',
      type: AlertType.HEALTH_DEGRADED,
      severity: AlertSeverity.WARNING,
      condition: (metrics, health) => {
        return Object.values(health).some(check => check.status === 'degraded');
      },
      message: 'Service health is degraded',
      details: 'One or more services are reporting degraded health status.',
      enabled: true,
      cooldown: 600000 // 10 minutes
    });

    // Gas price alert
    this.addRule({
      id: 'gas_price_high',
      name: 'High Gas Price Alert',
      type: AlertType.METRIC_THRESHOLD,
      severity: AlertSeverity.INFO,
      condition: (metrics, health) => {
        const gasPrice = metrics['bsc.gas_price'];
        return gasPrice ? Number(gasPrice.value) > 20 * 1e9 : false; // 20 Gwei threshold
      },
      message: 'BSC gas price is high',
      details: 'BSC gas price is above 20 Gwei. This may affect transaction costs for users.',
      enabled: true,
      cooldown: 600000 // 10 minutes
    });
  }

  /**
   * Setup default notification channels
   */
  private setupDefaultChannels(): void {
    // Console channel (always enabled)
    this.addChannel({
      id: 'console',
      name: 'Console Output',
      type: 'console',
      config: {},
      enabled: true
    });

    // Webhook channel (if configured)
    if (process.env.ALERT_WEBHOOK_URL) {
      this.addChannel({
        id: 'webhook',
        name: 'Webhook Alert',
        type: 'webhook',
        config: {
          url: process.env.ALERT_WEBHOOK_URL,
          headers: {
            'Content-Type': 'application/json'
          }
        },
        enabled: true
      });
    }

    // Slack channel (if configured)
    if (process.env.SLACK_WEBHOOK_URL) {
      this.addChannel({
        id: 'slack',
        name: 'Slack Notifications',
        type: 'slack',
        config: {
          url: process.env.SLACK_WEBHOOK_URL,
          channel: process.env.SLACK_CHANNEL || '#alerts'
        },
        enabled: true
      });
    }
  }

  /**
   * Start monitoring for alerts
   */
  private startMonitoring(): void {
    this.monitoring.on('metrics-updated', () => {
      this.checkRules();
    });

    this.monitoring.on('health-change', (data) => {
      if (data.currentStatus === 'unhealthy') {
        this.createAlert({
          type: AlertType.HEALTH_UNHEALTHY,
          severity: AlertSeverity.CRITICAL,
          title: `Service Unhealthy: ${data.service}`,
          message: `Service ${data.service} has become unhealthy`,
          details: data.healthCheck
        });
      }
    });

    console.log('🚨 Viem alerting system started');
  }

  /**
   * Check all alert rules
   */
  private checkRules(): void {
    const metrics = this.monitoring.getLatestMetrics();
    const health = this.monitoring.getHealthStatus();

    for (const [ruleId, rule] of this.rules.entries()) {
      if (!rule.enabled) continue;

      // Check cooldown
      const lastAlert = this.alertCooldowns.get(ruleId);
      if (lastAlert && Date.now() - lastAlert < rule.cooldown) {
        continue;
      }

      try {
        if (rule.condition(metrics, health)) {
          this.triggerRule(rule, metrics, health);
          this.alertCooldowns.set(ruleId, Date.now());
        }
      } catch (error) {
        console.error(`❌ Error evaluating alert rule ${ruleId}:`, error);
      }
    }
  }

  /**
   * Trigger an alert rule
   */
  private triggerRule(rule: AlertRule, metrics: Record<string, Metric>, health: Record<string, HealthCheck>): void {
    const alert: Alert = {
      id: `${rule.id}_${Date.now()}`,
      type: rule.type,
      severity: rule.severity,
      title: rule.name,
      message: rule.message,
      details: {
        rule: rule.id,
        condition: rule.details,
        metrics,
        health,
        timestamp: new Date().toISOString()
      },
      timestamp: Date.now(),
      acknowledged: false,
      resolved: false
    };

    this.createAlert(alert);
  }

  /**
   * Create and send an alert
   */
  private createAlert(alertData: Partial<Alert>): void {
    const alert: Alert = {
      id: alertData.id || `alert_${Date.now()}`,
      type: alertData.type || AlertType.CUSTOM,
      severity: alertData.severity || AlertSeverity.INFO,
      title: alertData.title || 'Custom Alert',
      message: alertData.message || 'Custom alert triggered',
      details: alertData.details || {},
      timestamp: Date.now(),
      acknowledged: false,
      resolved: false
    };

    this.alerts.set(alert.id, alert);
    this.sendAlert(alert);
    this.emit('alert', alert);
  }

  /**
   * Send alert through notification channels
   */
  private sendAlert(alert: Alert): void {
    for (const [channelId, channel] of this.channels.entries()) {
      if (!channel.enabled) continue;

      try {
        this.sendToChannel(channel, alert);
      } catch (error) {
        console.error(`❌ Failed to send alert to channel ${channelId}:`, error);
      }
    }
  }

  /**
   * Send alert to a specific channel
   */
  private sendToChannel(channel: NotificationChannel, alert: Alert): void {
    switch (channel.type) {
      case 'console':
        this.sendToConsole(alert);
        break;
      case 'webhook':
        this.sendToWebhook(channel, alert);
        break;
      case 'slack':
        this.sendToSlack(channel, alert);
        break;
      case 'email':
        this.sendToEmail(channel, alert);
        break;
      default:
        console.warn(`Unknown channel type: ${channel.type}`);
    }
  }

  /**
   * Send alert to console
   */
  private sendToConsole(alert: Alert): void {
    const severityColors = {
      [AlertSeverity.INFO]: '\x1b[36m',    // Cyan
      [AlertSeverity.WARNING]: '\x1b[33m', // Yellow
      [AlertSeverity.ERROR]: '\x1b[31m',   // Red
      [AlertSeverity.CRITICAL]: '\x1b[41m\x1b[37m' // Red background, white text
    };

    const reset = '\x1b[0m';
    const color = severityColors[alert.severity] || '';

    console.log(`${color}🚨 [${alert.severity.toUpperCase()}] ${alert.title}${reset}`);
    console.log(`${color}   ${alert.message}${reset}`);
    console.log(`${color}   Time: ${new Date(alert.timestamp).toISOString()}${reset}`);
    console.log(`${color}   Details: ${JSON.stringify(alert.details, null, 2)}${reset}`);
    console.log('');
  }

  /**
   * Send alert to webhook
   */
  private async sendToWebhook(channel: NotificationChannel, alert: Alert): Promise<void> {
    if (!channel.config.url) return;

    const payload = {
      alert,
      timestamp: new Date().toISOString(),
      service: 'moonex-viem'
    };

    const response = await fetch(channel.config.url, {
      method: 'POST',
      headers: {
        ...channel.config.headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Webhook failed with status ${response.status}`);
    }
  }

  /**
   * Send alert to Slack
   */
  private async sendToSlack(channel: NotificationChannel, alert: Alert): Promise<void> {
    if (!channel.config.url) return;

    const severityColors = {
      [AlertSeverity.INFO]: '#36a64f',    // Green
      [AlertSeverity.WARNING]: '#ff9500', // Orange
      [AlertSeverity.ERROR]: '#ff0000',    // Red
      [AlertSeverity.CRITICAL]: '#8b0000'  // Dark red
    };

    const color = severityColors[alert.severity] || '#36a64f';

    const payload = {
      channel: channel.config.channel,
      attachments: [{
        color,
        title: alert.title,
        text: alert.message,
        fields: [
          {
            title: 'Severity',
            value: alert.severity.toUpperCase(),
            short: true
          },
          {
            title: 'Time',
            value: new Date(alert.timestamp).toISOString(),
            short: true
          },
          {
            title: 'Alert ID',
            value: alert.id,
            short: true
          },
          {
            title: 'Service',
            value: 'MoonEx Viem',
            short: true
          }
        ],
        footer: 'MoonEx Viem Monitoring',
        ts: Math.floor(alert.timestamp / 1000)
      }]
    };

    const response = await fetch(channel.config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Slack webhook failed with status ${response.status}`);
    }
  }

  /**
   * Send alert via email
   */
  private sendToEmail(channel: NotificationChannel, alert: Alert): void {
    // Email implementation would go here
    console.log(`📧 Email alert sent: ${alert.title}`);
    // This is a placeholder - in production you'd use a service like SendGrid, SES, etc.
  }

  /**
   * Add an alert rule
   */
  addRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
  }

  /**
   * Remove an alert rule
   */
  removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
  }

  /**
   * Add a notification channel
   */
  addChannel(channel: NotificationChannel): void {
    this.channels.set(channel.id, channel);
  }

  /**
   * Remove a notification channel
   */
  removeChannel(channelId: string): void {
    this.channels.delete(channelId);
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      this.emit('alert-acknowledged', alert);
    }
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): void {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.resolved = true;
      alert.resolvedAt = Date.now();
      this.emit('alert-resolved', alert);
    }
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter(alert => !alert.resolved);
  }

  /**
   * Get all alerts
   */
  getAllAlerts(): Alert[] {
    return Array.from(this.alerts.values());
  }

  /**
   * Get alert statistics
   */
  getAlertStats(): any {
    const allAlerts = this.getAllAlerts();
    const activeAlerts = this.getActiveAlerts();

    return {
      total: allAlerts.length,
      active: activeAlerts.length,
      resolved: allAlerts.length - activeAlerts.length,
      bySeverity: {
        info: allAlerts.filter(a => a.severity === AlertSeverity.INFO).length,
        warning: allAlerts.filter(a => a.severity === AlertSeverity.WARNING).length,
        error: allAlerts.filter(a => a.severity === AlertSeverity.ERROR).length,
        critical: allAlerts.filter(a => a.severity === AlertSeverity.CRITICAL).length
      },
      byType: {
        metric_threshold: allAlerts.filter(a => a.type === AlertType.METRIC_THRESHOLD).length,
        health_degraded: allAlerts.filter(a => a.type === AlertType.HEALTH_DEGRADED).length,
        health_unhealthy: allAlerts.filter(a => a.type === AlertType.HEALTH_UNHEALTHY).length,
        performance_degraded: allAlerts.filter(a => a.type === AlertType.PERFORMANCE_DEGRADED).length,
        bsc_connectivity: allAlerts.filter(a => a.type === AlertType.BSC_CONNECTIVITY).length,
        memory_high: allAlerts.filter(a => a.type === AlertType.MEMORY_HIGH).length
      }
    };
  }
}

// Create singleton instance
let alertingInstance: ViemAlerting | null = null;

export function getViemAlerting(): ViemAlerting {
  if (!alertingInstance) {
    alertingInstance = new ViemAlerting();
  }
  return alertingInstance;
}

export function startViemAlerting(): ViemAlerting {
  const alerting = getViemAlerting();
  return alerting;
}