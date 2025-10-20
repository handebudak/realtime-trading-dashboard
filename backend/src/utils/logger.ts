import winston from 'winston';
import { config } from '../config/environment';
import path from 'path';
import fs from 'fs';
import _ from 'lodash';

// Create logs directory if it doesn't exist
const logsDir = path.dirname(config.LOGGING.FILE);
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss',
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// Define console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss',
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;
    
    if (Object.keys(meta).length > 0) {
      log += `\n${JSON.stringify(meta, null, 2)}`;
    }
    
    return log;
  })
);

// Create logger instance
export const logger = winston.createLogger({
  level: config.LOGGING.LEVEL,
  format: logFormat,
  defaultMeta: { service: 'trading-dashboard' },
  transports: [
    // Write all logs to file
    new winston.transports.File({
      filename: config.LOGGING.FILE,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    
    // Write error logs to separate file
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

// Add console transport for development
if (config.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
  }));
}

// Create a stream object for Morgan HTTP logger
export const morganStream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};

// Log unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Log uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Throttled logging functions to prevent spam
// Only logs once every 5 seconds for high-frequency events
export const throttledDebug = _.throttle((message: string, meta?: any) => {
  logger.debug(message, meta);
}, 5000);

export const throttledInfo = _.throttle((message: string, meta?: any) => {
  logger.info(message, meta);
}, 5000);

// Create throttled loggers per key (for per-symbol throttling)
const throttledLoggers = new Map<string, any>();

export const throttledLogPerKey = (key: string, level: 'debug' | 'info' | 'warn', message: string, meta?: any) => {
  const logKey = `${key}-${level}`;
  
  if (!throttledLoggers.has(logKey)) {
    const throttledFn = _.throttle((msg: string, data?: any) => {
      logger[level](msg, data);
    }, 5000);
    throttledLoggers.set(logKey, throttledFn);
  }
  
  const throttledLog = throttledLoggers.get(logKey);
  if (throttledLog) {
    throttledLog(message, meta);
  }
};

export default logger;

