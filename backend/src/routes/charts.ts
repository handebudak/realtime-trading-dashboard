import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { binanceService } from '../services/binanceService';
import { getRedisClient } from '../config/database';
import { logger } from '../utils/logger';

const router = Router();

// Types
interface Kline {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
  quoteVolume: string;
  tradesCount: number;
  takerBuyBaseVolume: string;
  takerBuyQuoteVolume: string;
}

interface ChartParams {
  symbol: string;
}

// Helper function to calculate time periods
const calculateTimeRange = (period: string) => {
  const now = Date.now();
  switch (period) {
    case 'hourly':
      return { startTime: now - (60 * 60 * 1000), endTime: now };
    case '4h':
      return { startTime: now - (4 * 60 * 60 * 1000), endTime: now };
    case 'daily':
      return { startTime: now - (24 * 60 * 60 * 1000), endTime: now };
    case 'weekly':
      return { startTime: now - (7 * 24 * 60 * 60 * 1000), endTime: now };
    case 'monthly':
      return { startTime: now - (30 * 24 * 60 * 60 * 1000), endTime: now };
    case 'yearly':
      return { startTime: now - (365 * 24 * 60 * 60 * 1000), endTime: now };
    default:
      return { startTime: now - (24 * 60 * 60 * 1000), endTime: now };
  }
};

// Helper function to get optimal limit based on interval and period
const getOptimalLimit = (interval: string, period: string): number => {
  const limits: Record<string, Record<string, number>> = {
    '1m': {
      'hourly': 60,
      '4h': 240,
      'daily': 1440,
      'weekly': 10080,
      'monthly': 43200
    },
    '5m': {
      'hourly': 12,
      '4h': 48,
      'daily': 288,
      'weekly': 2016,
      'monthly': 8640
    },
    '15m': {
      'hourly': 4,
      '4h': 16,
      'daily': 96,
      'weekly': 672,
      'monthly': 2880
    },
    '1h': {
      'hourly': 1,
      '4h': 4,
      'daily': 24,
      'weekly': 168,
      'monthly': 720
    },
    '4h': {
      'daily': 6,
      'weekly': 42,
      'monthly': 180
    },
    '1d': {
      'weekly': 7,
      'monthly': 30,
      'yearly': 365
    }
  };

  return limits[interval]?.[period] || 100;
};

// Helper function to fetch and cache klines
const fetchKlinesWithCache = async (
  symbol: string,
  interval: string,
  period: string,
  limit: number
): Promise<Kline[]> => {
  const redis = getRedisClient();
  const cacheKey = `klines:${symbol}:${interval}:${period}`;
  
  try {
    // Try to get from cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      logger.info(`Cache hit for ${cacheKey}`);
      return JSON.parse(cached);
    }

    // Calculate time range
    const { startTime, endTime } = calculateTimeRange(period);
    
    // Fetch from Binance
    logger.info(`Fetching klines from Binance: ${symbol} ${interval} ${period}`);
    const binanceKlines = await binanceService.getKlines(
      symbol,
      interval,
      startTime,
      endTime,
      limit
    );

    // Transform to our format
    const klines: Kline[] = binanceKlines.map((kline: any) => ({
      openTime: parseInt(kline[0]),
      open: kline[1],
      high: kline[2],
      low: kline[3],
      close: kline[4],
      volume: kline[5],
      closeTime: parseInt(kline[6]),
      quoteVolume: kline[7],
      tradesCount: parseInt(kline[8]),
      takerBuyBaseVolume: kline[9],
      takerBuyQuoteVolume: kline[10],
    }));

    // Cache for 5 minutes
    await redis.setEx(cacheKey, 300, JSON.stringify(klines));
    logger.info(`Cached klines for ${cacheKey}`);

    return klines;
  } catch (error) {
    logger.error('Error fetching klines:', error);
    throw error;
  }
};

// Day Trading: 15m interval + 4h period
router.get('/day-trading/:symbol', asyncHandler(async (req: Request, res: Response) => {
  const { symbol } = req.params as unknown as ChartParams;
  const interval = '15m';
  const period = '4h';
  const limit = getOptimalLimit(interval, period);

  try {
    const klines = await fetchKlinesWithCache(symbol, interval, period, limit);
    
    res.status(200).json({
      success: true,
      data: {
        symbol: symbol.toUpperCase(),
        interval,
        period,
        klines,
        total: klines.length,
        strategy: 'Day Trading',
        description: 'Gün içi işlemler için 15 dakikalık mumlar, son 4 saat'
      }
    });
  } catch (error: any) {
    logger.error('Day trading chart error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch day trading data',
      error: error.message
    });
  }
}));

// Swing Trading: 1h interval + 1w period
router.get('/swing-trading/:symbol', asyncHandler(async (req: Request, res: Response) => {
  const { symbol } = req.params as unknown as ChartParams;
  const interval = '1h';
  const period = 'weekly';
  const limit = getOptimalLimit(interval, period);

  try {
    const klines = await fetchKlinesWithCache(symbol, interval, period, limit);
    
    res.status(200).json({
      success: true,
      data: {
        symbol: symbol.toUpperCase(),
        interval,
        period,
        klines,
        total: klines.length,
        strategy: 'Swing Trading',
        description: 'Orta vadeli pozisyonlar için saatlik mumlar, son 1 hafta'
      }
    });
  } catch (error: any) {
    logger.error('Swing trading chart error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch swing trading data',
      error: error.message
    });
  }
}));

// Scalping: 5m interval + 1h period
router.get('/scalping/:symbol', asyncHandler(async (req: Request, res: Response) => {
  const { symbol } = req.params as unknown as ChartParams;
  const interval = '5m';
  const period = 'hourly';
  const limit = getOptimalLimit(interval, period);

  try {
    const klines = await fetchKlinesWithCache(symbol, interval, period, limit);
    
    res.status(200).json({
      success: true,
      data: {
        symbol: symbol.toUpperCase(),
        interval,
        period,
        klines,
        total: klines.length,
        strategy: 'Scalping',
        description: 'Hızlı kar alma için 5 dakikalık mumlar, son 1 saat'
      }
    });
  } catch (error: any) {
    logger.error('Scalping chart error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch scalping data',
      error: error.message
    });
  }
}));

// Position Trading: 1d interval + 1m period
router.get('/position-trading/:symbol', asyncHandler(async (req: Request, res: Response) => {
  const { symbol } = req.params as unknown as ChartParams;
  const interval = '1d';
  const period = 'monthly';
  const limit = getOptimalLimit(interval, period);

  try {
    const klines = await fetchKlinesWithCache(symbol, interval, period, limit);
    
    res.status(200).json({
      success: true,
      data: {
        symbol: symbol.toUpperCase(),
        interval,
        period,
        klines,
        total: klines.length,
        strategy: 'Position Trading',
        description: 'Uzun vadeli yatırım için günlük mumlar, son 1 ay'
      }
    });
  } catch (error: any) {
    logger.error('Position trading chart error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch position trading data',
      error: error.message
    });
  }
}));

// Long-term Investment: 1d interval + 1y period
router.get('/long-term-investment/:symbol', asyncHandler(async (req: Request, res: Response) => {
  const { symbol } = req.params as unknown as ChartParams;
  const interval = '1d';
  const period = 'yearly';
  const limit = getOptimalLimit(interval, period);

  try {
    const klines = await fetchKlinesWithCache(symbol, interval, period, limit);
    
    res.status(200).json({
      success: true,
      data: {
        symbol: symbol.toUpperCase(),
        interval,
        period,
        klines,
        total: klines.length,
        strategy: 'Long-term Investment',
        description: 'Uzun vadeli yatırım için günlük mumlar, son 1 yıl'
      }
    });
  } catch (error: any) {
    logger.error('Long-term investment chart error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch long-term investment data',
      error: error.message
    });
  }
}));

export { router as chartsRoutes };
