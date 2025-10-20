import { Application } from 'express';
import { authRoutes } from './auth';
import { marketDataRoutes } from './marketData';
import { tradingRoutes } from './trading';
import { systemRoutes } from './system';
import { chartsRoutes } from './charts';
import { notFoundHandler } from '../middleware/errorHandler';

export const setupRoutes = (app: Application): void => {
  // API version prefix
  const apiPrefix = '/api/v1';

  // Health check route
  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env['NODE_ENV'],
    });
  });

  // API routes
  app.use(`${apiPrefix}/auth`, authRoutes);
  app.use(`${apiPrefix}/market-data`, marketDataRoutes);
  app.use(`${apiPrefix}/trading`, tradingRoutes);
  app.use(`${apiPrefix}/system`, systemRoutes);
  app.use(`${apiPrefix}/charts`, chartsRoutes);

  // 404 handler for undefined routes
  app.use(notFoundHandler);
};
