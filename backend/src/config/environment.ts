import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const config = {
  // Server Configuration
  NODE_ENV: process.env['NODE_ENV'] || 'development',
  PORT: parseInt(process.env['PORT'] || '3002', 10),
  HOST: process.env['HOST'] || '0.0.0.0',

  // JWT Configuration
  JWT_SECRET: process.env['JWT_SECRET'] || 'your-super-secret-jwt-key-change-this-in-production',
  JWT_EXPIRES_IN: process.env['JWT_EXPIRES_IN'] || '24h',
  JWT_REFRESH_EXPIRES_IN: process.env['JWT_REFRESH_EXPIRES_IN'] || '7d',

  // PostgreSQL Database Configuration
  POSTGRES: {
    HOST: process.env['POSTGRES_HOST'] || 'localhost',
    PORT: parseInt(process.env['POSTGRES_PORT'] || '5432', 10),
    DATABASE: process.env['POSTGRES_DB'] || 'trading_dashboard',
    USER: process.env['POSTGRES_USER'] || 'postgres',
    PASSWORD: process.env['POSTGRES_PASSWORD'] || 'password',
    SSL: process.env['POSTGRES_SSL'] === 'true',
  },

  // ClickHouse Database Configuration
  CLICKHOUSE: {
    HOST: process.env['CLICKHOUSE_HOST'] || 'localhost',
    PORT: parseInt(process.env['CLICKHOUSE_PORT'] || '8123', 10),
    DATABASE: process.env['CLICKHOUSE_DATABASE'] || 'trading_analytics',
    USERNAME: process.env['CLICKHOUSE_USERNAME'] || 'default',
    PASSWORD: process.env['CLICKHOUSE_PASSWORD'] || '',
    SSL: process.env['CLICKHOUSE_SSL'] === 'true',
  },

  // Redis Configuration
  REDIS: {
    HOST: process.env['REDIS_HOST'] || 'localhost',
    PORT: parseInt(process.env['REDIS_PORT'] || '6379', 10),
    PASSWORD: process.env['REDIS_PASSWORD'] || '',
    DB: parseInt(process.env['REDIS_DB'] || '0', 10),
  },

  // CORS Configuration
  CORS: {
    ORIGIN: process.env['CORS_ORIGIN'] || 'http://localhost:3000',
    CREDENTIALS: process.env['CORS_CREDENTIALS'] === 'true',
  },

  // Rate Limiting
  RATE_LIMIT: {
    WINDOW_MS: parseInt(process.env['RATE_LIMIT_WINDOW_MS'] || '900000', 10),
    MAX_REQUESTS: parseInt(process.env['RATE_LIMIT_MAX_REQUESTS'] || '100', 10),
  },

  // WebSocket Configuration
  WS: {
    PORT: parseInt(process.env['WS_PORT'] || '3002', 10),
    CORS_ORIGIN: process.env['WS_CORS_ORIGIN'] || 'http://localhost:3000',
  },

  // Logging Configuration
  LOGGING: {
    LEVEL: process.env['LOG_LEVEL'] || 'info',
    FILE: process.env['LOG_FILE'] || 'logs/app.log',
  },

  // Trading System Configuration
  TRADING_SYSTEM: {
    URL: process.env['TRADING_SYSTEM_URL'] || 'http://localhost:8080',
    API_KEY: process.env['TRADING_SYSTEM_API_KEY'] || 'your-trading-system-api-key',
  },

  // Market Data Configuration
  MARKET_DATA: {
    PROVIDER: process.env['MARKET_DATA_PROVIDER'] || 'binance',
    UPDATE_INTERVAL: parseInt(process.env['MARKET_DATA_UPDATE_INTERVAL'] || '1000', 10),
  },
};

// Validation function to check required environment variables
export const validateConfig = (): void => {
  const requiredVars = [
    'JWT_SECRET',
  ];

  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
};

export default config;
