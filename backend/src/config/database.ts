import { Pool, PoolClient } from 'pg';
import { createClient, RedisClientType } from 'redis';
import { ClickHouseClient, createClient as createClickHouseClient } from '@clickhouse/client';

import { config } from './environment';
import { logger } from '../utils/logger';

// PostgreSQL connection
let postgresPool: Pool | null = null;

export const getPostgresPool = (): Pool => {
  if (!postgresPool) {
    postgresPool = new Pool({
      host: config.POSTGRES.HOST,
      port: config.POSTGRES.PORT,
      database: config.POSTGRES.DATABASE,
      user: config.POSTGRES.USER,
      password: config.POSTGRES.PASSWORD,
      ssl: config.POSTGRES.SSL ? { rejectUnauthorized: false } : false,
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
    });

    postgresPool.on('error', (err) => {
      logger.error('Unexpected error on idle PostgreSQL client', err);
    });
  }
  return postgresPool;
};

export const getPostgresClient = async (): Promise<PoolClient> => {
  const pool = getPostgresPool();
  return await pool.connect();
};

// ClickHouse connection
let clickHouseClient: ClickHouseClient | null = null;

export const getClickHouseClient = (): ClickHouseClient => {
  if (!clickHouseClient) {
    clickHouseClient = createClickHouseClient({
      host: `http://${config.CLICKHOUSE.HOST}:${config.CLICKHOUSE.PORT}`,
      database: config.CLICKHOUSE.DATABASE,
      username: config.CLICKHOUSE.USERNAME,
      password: config.CLICKHOUSE.PASSWORD,
      clickhouse_settings: {
        async_insert: 1,
        wait_for_async_insert: 0,
        async_insert_max_data_size: '10485760', // 10MB
        async_insert_busy_timeout_ms: 200,
        async_insert_stale_timeout_ms: 0,
      },
    });
  }
  return clickHouseClient;
};

// Redis connection
let redisClient: RedisClientType | null = null;

export const getRedisClient = (): RedisClientType => {
  if (!redisClient) {
    const redisConfig: any = {
      socket: {
        host: config.REDIS.HOST,
        port: config.REDIS.PORT,
      },
      database: config.REDIS.DB,
    };

    if (config.REDIS.PASSWORD) {
      redisConfig.password = config.REDIS.PASSWORD;
    }

    redisClient = createClient(redisConfig);

    redisClient.on('error', (err) => {
      logger.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      logger.info('Redis Client Connected');
    });

    redisClient.on('ready', () => {
      logger.info('Redis Client Ready');
    });

    redisClient.on('end', () => {
      logger.info('Redis Client Disconnected');
    });
  }
  return redisClient;
};

// Database connection function
export const connectDatabases = async (): Promise<void> => {
  try {
    // Test PostgreSQL connection
    const postgresPool = getPostgresPool();
    const postgresClient = await postgresPool.connect();
    await postgresClient.query('SELECT NOW()');
    postgresClient.release();
    logger.info('✅ PostgreSQL connected successfully');

    // Test ClickHouse connection
    const clickHouseClient = getClickHouseClient();
    await clickHouseClient.ping();
    logger.info('✅ ClickHouse connected successfully');

    // Test Redis connection
    const redisClient = getRedisClient();
    await redisClient.connect();
    await redisClient.ping();
    logger.info('✅ Redis connected successfully');

  } catch (error) {
    logger.error('❌ Database connection failed:', error);
    throw error;
  }
};

// Graceful shutdown function
export const closeDatabaseConnections = async (): Promise<void> => {
  try {
    if (postgresPool) {
      await postgresPool.end();
      logger.info('PostgreSQL connection pool closed');
    }

    if (clickHouseClient) {
      await clickHouseClient.close();
      logger.info('ClickHouse connection closed');
    }

    if (redisClient) {
      await redisClient.quit();
      logger.info('Redis connection closed');
    }
  } catch (error) {
    logger.error('Error closing database connections:', error);
  }
};
