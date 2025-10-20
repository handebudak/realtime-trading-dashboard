import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createServer } from 'http';

import { config, validateConfig } from './config/environment';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { rateLimiter } from './middleware/rateLimiter';
import { connectDatabases } from './config/database';
import { setupRoutes } from './routes';
import { setupWebSocketServer, closeWebSocketServer } from './services/websocket';
import { backfillService } from './services/backfillService';

class TradingDashboardServer {
  private app: express.Application;
  private server: any;

  constructor() {
    this.app = express();
    this.server = createServer(this.app);
  }

  private async initialize(): Promise<void> {
    try {
      // Validate environment variables
      validateConfig();

      // Connect to databases
      await connectDatabases();

      // Setup middleware
      this.setupMiddleware();

      // Setup routes
      setupRoutes(this.app);

      // Setup WebSocket server
      setupWebSocketServer(this.server);

      // Setup error handling
      this.app.use(errorHandler);

      // Start historical data backfill (async, non-blocking)
      this.startBackfill();

      logger.info('Server initialization completed successfully');
    } catch (error) {
      logger.error('Failed to initialize server:', error);
      process.exit(1);
    }
  }

  private startBackfill(): void {
    // Skip backfill in development after first run (to avoid spam)
    // Set SKIP_BACKFILL=true in .env to disable
    if (process.env['SKIP_BACKFILL'] === 'true') {
      logger.info('⏭️ Skipping historical data backfill (SKIP_BACKFILL=true)')
      return
    }

    // Run backfill asynchronously (don't block server startup)
    logger.info('🔄 Starting historical data backfill in background...')
    
    backfillService.backfillHistoricalData()
      .then(() => {
        logger.info('✅ Historical data backfill completed successfully!')
        logger.info('💡 Tip: Set SKIP_BACKFILL=true in .env to disable backfill on next restart')
      })
      .catch((error) => {
        logger.error('❌ Historical data backfill failed:', error)
        // Don't crash server if backfill fails
      })
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    }));

    // CORS middleware - Allow all origins in development
    this.app.use(cors({
      origin: config.NODE_ENV === 'development' ? true : config.CORS.ORIGIN,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    }));

    // Rate limiting
    this.app.use(rateLimiter);

    // Logging middleware
    this.app.use(morgan('combined', {
      stream: {
        write: (message: string) => logger.info(message.trim()),
      },
    }));

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Health check endpoint
    this.app.get('/health', (_req, res) => {
      res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: config.NODE_ENV,
      });
    });
  }

  public async start(): Promise<void> {
    await this.initialize();

    this.server.listen(config.PORT, config.HOST, () => {
      logger.info(`🚀 Trading Dashboard Server is running on ${config.HOST}:${config.PORT}`);
      logger.info(`📊 Environment: ${config.NODE_ENV}`);
      logger.info(`🔌 WebSocket server ready on ws://${config.HOST}:${config.PORT}/ws`);
    });

    // Graceful shutdown
    process.on('SIGTERM', this.gracefulShutdown.bind(this));
    process.on('SIGINT', this.gracefulShutdown.bind(this));
  }

  private async gracefulShutdown(signal: string): Promise<void> {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);

    // Close WebSocket connections
    closeWebSocketServer();

    // Close HTTP server
    this.server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });

    // Force close after 30 seconds
    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 30000);
  }
}

// Start the server
const server = new TradingDashboardServer();
server.start().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});

export default server;
