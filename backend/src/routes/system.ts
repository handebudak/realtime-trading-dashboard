import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { alertService } from '../services/alertService';

const router = Router();

// Performance metrics tracking
let requestCount = 0;
let errorCount = 0;
let totalLatency = 0;
let latencyCount = 0;
const startTime = Date.now();

// Middleware to track request metrics
router.use((_req: Request, res: Response, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const latency = Date.now() - start;
    requestCount++;
    totalLatency += latency;
    latencyCount++;
    
    if (res.statusCode >= 400) {
      errorCount++;
    }

    // Calculate current metrics
    const avgLatency = latencyCount > 0 ? totalLatency / latencyCount : 0;
    const errorRate = requestCount > 0 ? (errorCount / requestCount) * 100 : 0;
    const uptime = (Date.now() - startTime) / 1000; // seconds
    const throughput = uptime > 0 ? requestCount / uptime : 0;

    // Check metrics for alerts (throttled to every 10th request)
    if (requestCount % 10 === 0) {
      alertService.checkMetrics({
        latency: avgLatency,
        errorRate,
        throughput
      });
    }
  });
  
  next();
});

// GET /api/v1/system/status
router.get('/status', asyncHandler(async (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'System status retrieved',
    data: {
      status: 'healthy',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      timestamp: new Date().toISOString(),
    },
  });
}));

// GET /api/v1/system/metrics
router.get('/metrics', asyncHandler(async (_req: Request, res: Response) => {
  const uptime = (Date.now() - startTime) / 1000; // seconds
  const avgLatency = latencyCount > 0 ? totalLatency / latencyCount : 0;
  const errorRate = requestCount > 0 ? (errorCount / requestCount) * 100 : 0;
  const throughput = uptime > 0 ? requestCount / uptime : 0;

  res.status(200).json({
    success: true,
    message: 'System metrics retrieved',
    data: {
      performance: {
        latency: parseFloat(avgLatency.toFixed(2)),
        throughput: parseFloat(throughput.toFixed(2)),
        errorRate: parseFloat(errorRate.toFixed(2)),
        uptime: parseFloat((process.uptime() / 3600).toFixed(1)), // hours
      },
      requests: {
        total: requestCount,
        errors: errorCount,
        successRate: requestCount > 0 ? ((requestCount - errorCount) / requestCount) * 100 : 100,
      },
      timestamp: new Date().toISOString(),
    },
  });
}));

// GET /api/v1/system/alerts
router.get('/alerts', asyncHandler(async (req: Request, res: Response) => {
  const { acknowledged, severity, type } = req.query;
  
  const filters: any = {};
  if (acknowledged !== undefined) {
    filters.acknowledged = acknowledged === 'true';
  }
  if (severity) {
    filters.severity = severity;
  }
  if (type) {
    filters.type = type;
  }

  const alerts = alertService.getAlerts(filters);
  const unacknowledgedCount = alertService.getUnacknowledgedCount();

  res.status(200).json({
    success: true,
    message: 'System alerts retrieved',
    data: {
      alerts,
      unacknowledgedCount,
      total: alerts.length,
      thresholds: alertService.getThresholds(),
    },
  });
}));

// POST /api/v1/system/alerts/:alertId/acknowledge
router.post('/alerts/:alertId/acknowledge', asyncHandler(async (req: Request, res: Response) => {
  const { alertId } = req.params;
  
  if (!alertId) {
    return res.status(400).json({
      success: false,
      message: 'Alert ID required',
      error: {
        code: 'MISSING_ALERT_ID',
        message: 'Alert ID is required',
      },
    });
  }
  
  const success = alertService.acknowledgeAlert(alertId);
  
  if (!success) {
    return res.status(404).json({
      success: false,
      message: 'Alert not found',
      error: {
        code: 'ALERT_NOT_FOUND',
        message: `Alert with ID ${alertId} not found`,
      },
    });
  }

  return res.status(200).json({
    success: true,
    message: `Alert ${alertId} acknowledged`,
    data: {
      alertId,
      status: 'acknowledged',
      timestamp: new Date().toISOString(),
    },
  });
}));

// POST /api/v1/system/alerts/acknowledge-all
router.post('/alerts/acknowledge-all', asyncHandler(async (_req: Request, res: Response) => {
  alertService.acknowledgeAll();
  
  res.status(200).json({
    success: true,
    message: 'All alerts acknowledged',
    data: {
      timestamp: new Date().toISOString(),
    },
  });
}));

// GET /api/v1/system/logs
router.get('/logs', asyncHandler(async (req: Request, res: Response) => {
  const { level: _level, limit = 100, offset = 0 } = req.query;
  
  // TODO: Implement get system logs
  res.status(200).json({
    success: true,
    message: 'System logs retrieved',
    data: {
      logs: [
        {
          id: '1',
          level: 'info',
          message: 'Order executed successfully',
          timestamp: new Date().toISOString(),
        },
      ],
      pagination: {
        total: 1,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      },
    },
  });
}));

export { router as systemRoutes };
