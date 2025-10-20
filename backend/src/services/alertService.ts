import { logger } from '../utils/logger';
import { EventEmitter } from 'events';

export interface Alert {
  id: string;
  type: 'LATENCY' | 'ERROR_RATE' | 'THROUGHPUT' | 'WEBSOCKET';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  value: number;
  threshold: number;
  timestamp: Date;
  acknowledged: boolean;
}

export interface AlertThresholds {
  latency: {
    warning: number;    // 50ms
    critical: number;   // 100ms
  };
  errorRate: {
    warning: number;    // 1%
    critical: number;   // 5%
  };
  throughput: {
    warning: number;    // 100 req/s
    critical: number;   // 50 req/s
  };
  websocketConnections: {
    warning: number;    // 500 connections
    critical: number;   // 1000 connections
  };
}

class AlertService extends EventEmitter {
  private alerts: Alert[] = [];
  private thresholds: AlertThresholds = {
    latency: {
      warning: 50,      // 50ms
      critical: 100     // 100ms
    },
    errorRate: {
      warning: 1,       // 1%
      critical: 5       // 5%
    },
    throughput: {
      warning: 1,       // Demo: Low throughput warning (1 req/s)
      critical: 0.5     // Demo: Critical low throughput (0.5 req/s)
    },
    websocketConnections: {
      warning: 500,
      critical: 1000
    }
  };

  /**
   * Check metrics and create alerts if thresholds exceeded
   */
  checkMetrics(metrics: {
    latency?: number;
    errorRate?: number;
    throughput?: number;
    websocketConnections?: number;
  }): Alert[] {
    const newAlerts: Alert[] = [];

    // Check latency
    if (metrics.latency !== undefined) {
      if (metrics.latency >= this.thresholds.latency.critical) {
        newAlerts.push(this.createAlert({
          type: 'LATENCY',
          severity: 'CRITICAL',
          message: `Critical latency: ${metrics.latency.toFixed(2)}ms (threshold: ${this.thresholds.latency.critical}ms)`,
          value: metrics.latency,
          threshold: this.thresholds.latency.critical
        }));
      } else if (metrics.latency >= this.thresholds.latency.warning) {
        newAlerts.push(this.createAlert({
          type: 'LATENCY',
          severity: 'MEDIUM',
          message: `High latency: ${metrics.latency.toFixed(2)}ms (threshold: ${this.thresholds.latency.warning}ms)`,
          value: metrics.latency,
          threshold: this.thresholds.latency.warning
        }));
      }
    }

    // Check error rate
    if (metrics.errorRate !== undefined) {
      if (metrics.errorRate >= this.thresholds.errorRate.critical) {
        newAlerts.push(this.createAlert({
          type: 'ERROR_RATE',
          severity: 'CRITICAL',
          message: `Critical error rate: ${metrics.errorRate.toFixed(2)}% (threshold: ${this.thresholds.errorRate.critical}%)`,
          value: metrics.errorRate,
          threshold: this.thresholds.errorRate.critical
        }));
      } else if (metrics.errorRate >= this.thresholds.errorRate.warning) {
        newAlerts.push(this.createAlert({
          type: 'ERROR_RATE',
          severity: 'MEDIUM',
          message: `High error rate: ${metrics.errorRate.toFixed(2)}% (threshold: ${this.thresholds.errorRate.warning}%)`,
          value: metrics.errorRate,
          threshold: this.thresholds.errorRate.warning
        }));
      }
    }

    // Check throughput (low throughput is a problem)
    if (metrics.throughput !== undefined) {
      if (metrics.throughput <= this.thresholds.throughput.critical) {
        newAlerts.push(this.createAlert({
          type: 'THROUGHPUT',
          severity: 'CRITICAL',
          message: `Critical low throughput: ${metrics.throughput} req/s (threshold: ${this.thresholds.throughput.critical} req/s)`,
          value: metrics.throughput,
          threshold: this.thresholds.throughput.critical
        }));
      } else if (metrics.throughput <= this.thresholds.throughput.warning) {
        newAlerts.push(this.createAlert({
          type: 'THROUGHPUT',
          severity: 'MEDIUM',
          message: `Low throughput: ${metrics.throughput} req/s (threshold: ${this.thresholds.throughput.warning} req/s)`,
          value: metrics.throughput,
          threshold: this.thresholds.throughput.warning
        }));
      }
    }

    // Check WebSocket connections
    if (metrics.websocketConnections !== undefined) {
      if (metrics.websocketConnections >= this.thresholds.websocketConnections.critical) {
        newAlerts.push(this.createAlert({
          type: 'WEBSOCKET',
          severity: 'CRITICAL',
          message: `Critical WebSocket connections: ${metrics.websocketConnections} (threshold: ${this.thresholds.websocketConnections.critical})`,
          value: metrics.websocketConnections,
          threshold: this.thresholds.websocketConnections.critical
        }));
      } else if (metrics.websocketConnections >= this.thresholds.websocketConnections.warning) {
        newAlerts.push(this.createAlert({
          type: 'WEBSOCKET',
          severity: 'MEDIUM',
          message: `High WebSocket connections: ${metrics.websocketConnections} (threshold: ${this.thresholds.websocketConnections.warning})`,
          value: metrics.websocketConnections,
          threshold: this.thresholds.websocketConnections.warning
        }));
      }
    }

    // Store alerts and emit events
    newAlerts.forEach(alert => {
      this.alerts.push(alert);
      this.emit('alert', alert);
      logger.warn('Alert created', {
        id: alert.id,
        type: alert.type,
        severity: alert.severity,
        message: alert.message
      });
    });

    return newAlerts;
  }

  /**
   * Create a new alert
   */
  private createAlert(data: {
    type: Alert['type'];
    severity: Alert['severity'];
    message: string;
    value: number;
    threshold: number;
  }): Alert {
    return {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: data.type,
      severity: data.severity,
      message: data.message,
      value: data.value,
      threshold: data.threshold,
      timestamp: new Date(),
      acknowledged: false
    };
  }

  /**
   * Get all alerts
   */
  getAlerts(filters?: {
    acknowledged?: boolean;
    severity?: Alert['severity'];
    type?: Alert['type'];
  }): Alert[] {
    let filtered = [...this.alerts];

    if (filters?.acknowledged !== undefined) {
      filtered = filtered.filter(a => a.acknowledged === filters.acknowledged);
    }

    if (filters?.severity) {
      filtered = filtered.filter(a => a.severity === filters.severity);
    }

    if (filters?.type) {
      filtered = filtered.filter(a => a.type === filters.type);
    }

    return filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get unacknowledged alerts count
   */
  getUnacknowledgedCount(): number {
    return this.alerts.filter(a => !a.acknowledged).length;
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      logger.info('Alert acknowledged', { alertId });
      return true;
    }
    return false;
  }

  /**
   * Acknowledge all alerts
   */
  acknowledgeAll(): void {
    this.alerts.forEach(alert => {
      alert.acknowledged = true;
    });
    logger.info('All alerts acknowledged');
  }

  /**
   * Clear old alerts (older than 24 hours)
   */
  clearOldAlerts(): void {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    this.alerts = this.alerts.filter(a => a.timestamp > oneDayAgo);
    logger.info('Old alerts cleared');
  }

  /**
   * Update thresholds
   */
  updateThresholds(newThresholds: Partial<AlertThresholds>): void {
    this.thresholds = {
      ...this.thresholds,
      ...newThresholds
    };
    logger.info('Alert thresholds updated', { thresholds: this.thresholds });
  }

  /**
   * Get current thresholds
   */
  getThresholds(): AlertThresholds {
    return { ...this.thresholds };
  }
}

export const alertService = new AlertService();

// Clear old alerts every hour
setInterval(() => {
  alertService.clearOldAlerts();
}, 60 * 60 * 1000);

export default alertService;

