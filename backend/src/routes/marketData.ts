import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { binanceService } from '../services/binanceService';
import { clickhouseService } from '../services/clickhouseService';
import { backfillService } from '../services/backfillService';
import { logger } from '../utils/logger';

const router = Router();

// GET /api/v1/market-data/symbols
router.get('/symbols', asyncHandler(async (_req: Request, res: Response) => {
  try {
    // Only use symbols with real WebSocket data from Binance
    const realTimeSymbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT'];
    
    // Get 24hr ticker data for these symbols
    const tickerData = await binanceService.get24hrTicker() as any[];
    
    // Filter and format the data
    const symbols = realTimeSymbols.map(symbol => {
      const ticker = tickerData.find(t => t.symbol === symbol);
      return {
        symbol: symbol,
        base: symbol.replace('USDT', ''),
        quote: 'USDT',
        status: 'active',
        price: ticker?.lastPrice || '0',
        change: ticker?.priceChange || '0',
        changePercent: ticker?.priceChangePercent || '0',
        volume: ticker?.volume || '0',
        high: ticker?.highPrice || '0',
        low: ticker?.lowPrice || '0',
      };
    });

    res.status(200).json({
      success: true,
      message: 'Available trading symbols with real-time data',
      data: {
        symbols: symbols,
      },
    });
  } catch (error: any) {
    console.error('Error fetching symbols from Binance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch symbols from Binance',
      error: error.message,
    });
  }
}));

// GET /api/v1/market-data/ticker/:symbol
router.get('/ticker/:symbol', asyncHandler(async (req: Request, res: Response) => {
  const { symbol } = req.params;
  
  try {
    // Get real ticker data from Binance
    const tickerData = await binanceService.get24hrTicker(symbol) as any;
    
    res.status(200).json({
      success: true,
      message: `Ticker data for ${symbol} from Binance`,
      data: {
        symbol: tickerData.symbol,
        price: tickerData.lastPrice,
        change: tickerData.priceChange,
        changePercent: tickerData.priceChangePercent,
        volume: tickerData.volume,
        high: tickerData.highPrice,
        low: tickerData.lowPrice,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error(`Error fetching ticker data for ${symbol}:`, error);
    res.status(500).json({
      success: false,
      message: `Failed to fetch ticker data for ${symbol}`,
      error: error.message,
    });
  }
}));

// GET /api/v1/market-data/orderbook/:symbol
router.get('/orderbook/:symbol', asyncHandler(async (req: Request, res: Response) => {
  const { symbol } = req.params;
  const { limit: _limit = 100 } = req.query;
  
  // TODO: Implement get orderbook data
  res.status(200).json({
    success: true,
    message: `Orderbook data for ${symbol}`,
    data: {
      symbol,
      bids: [
        { price: '49950.00', quantity: '1.5' },
        { price: '49900.00', quantity: '2.0' },
        { price: '49850.00', quantity: '1.8' },
      ],
      asks: [
        { price: '50050.00', quantity: '1.2' },
        { price: '50100.00', quantity: '1.7' },
        { price: '50150.00', quantity: '2.1' },
      ],
      timestamp: new Date().toISOString(),
    },
  });
}));

// GET /api/v1/market-data/trades/:symbol
router.get('/trades/:symbol', asyncHandler(async (req: Request, res: Response) => {
  const { symbol } = req.params;
  const { limit: _limit = 100 } = req.query;
  
  // TODO: Implement get recent trades
  res.status(200).json({
    success: true,
    message: `Recent trades for ${symbol}`,
    data: {
      symbol,
      trades: [
        {
          id: '1',
          price: '50000.00',
          quantity: '0.5',
          side: 'buy',
          timestamp: new Date().toISOString(),
        },
        {
          id: '2',
          price: '49995.00',
          quantity: '1.2',
          side: 'sell',
          timestamp: new Date().toISOString(),
        },
      ],
    },
  });
}));

// GET /api/v1/market-data/klines
router.get('/klines', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { symbol, interval = '15m', period, limit: reqLimit } = req.query;
  
  if (!symbol || typeof symbol !== 'string') {
    res.status(400).json({
      success: false,
      message: 'Symbol is required',
    });
    return;
  }

  try {
    let limit: number;
    
    // If limit is explicitly provided (for RSI chart), use it
    if (reqLimit && typeof reqLimit === 'string') {
      limit = parseInt(reqLimit);
    } else if (period && typeof period === 'string') {
      // Otherwise calculate limit based on period AND interval (for Volume chart)
      limit = getLimitByPeriod(period, interval as string);
    } else {
      // Default fallback
      limit = 100;
    }
    
    // Calculate limit based on period AND interval (aligned with frontend)
    function getLimitByPeriod(period: string, interval: string): number {
      // Convert period to milliseconds (supporting all real trading combinations)
      const periodMs: { [key: string]: number } = {
        '1h': 60 * 60 * 1000,
        '2h': 2 * 60 * 60 * 1000,
        '4h': 4 * 60 * 60 * 1000,
        '8h': 8 * 60 * 60 * 1000,
        '12h': 12 * 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '1d': 24 * 60 * 60 * 1000,
        '2d': 2 * 24 * 60 * 60 * 1000,
        '3d': 3 * 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '10d': 10 * 24 * 60 * 60 * 1000,
        '14d': 14 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000,
        '90d': 90 * 24 * 60 * 60 * 1000
      };
      
      // Convert interval to milliseconds
      const getIntervalMs = (interval: string): number => {
        const unit = interval.slice(-1);
        const value = parseInt(interval.slice(0, -1)) || 1;
        const multipliers: Record<string, number> = {
          'm': 60 * 1000,
          'h': 60 * 60 * 1000,
          'd': 24 * 60 * 60 * 1000
        };
        return value * (multipliers[unit] || 60 * 1000);
      };
      
      const pMs = periodMs[period] || periodMs['24h'] || (24 * 60 * 60 * 1000);
      const iMs = getIntervalMs(interval);
      
      // Calculate number of candles: period / interval
      return Math.ceil(pMs / iMs);
    }

    // Calculate startTime to get RECENT data
    const getIntervalMs = (interval: string): number => {
      const unit = interval.slice(-1);
      const value = parseInt(interval.slice(0, -1)) || 15;
      const multipliers: Record<string, number> = {
        'm': 60 * 1000,
        'h': 60 * 60 * 1000,
        'd': 24 * 60 * 60 * 1000,
        'w': 7 * 24 * 60 * 60 * 1000
      };
      return value * (multipliers[unit] || 60 * 1000);
    };

    const now = Date.now();
    const intervalMs = getIntervalMs(interval as string);
    const startTime = now - (intervalMs * limit);
    const endTime = now;

    // ⭐ STEP 1: Try to get data from ClickHouse first (our own database)
    logger.info(`📊 Checking ClickHouse for ${symbol} ${interval} (${limit} candles)...`)
    
    // IMPORTANT: Don't pass time range, just get latest data!
    let clickhouseData = await clickhouseService.getHistoricalKlines(
      symbol.toUpperCase(),
      interval as string,
      undefined,  // No start time filter
      undefined,  // No end time filter
      limit
    )

    // ⭐ STEP 2: If not enough data in ClickHouse, backfill from Binance
    if (!clickhouseData || clickhouseData.length < limit * 0.8) { // If less than 80% of requested data
      logger.warn(`⚠️ Insufficient data in ClickHouse (${clickhouseData?.length || 0}/${limit}), backfilling from Binance...`)
      
      // Backfill this specific symbol/interval
      await backfillService.backfillSymbolInterval(
        symbol.toUpperCase(),
        interval as string,
        7 // Last 7 days
      )

      // Query again after backfill
      clickhouseData = await clickhouseService.getHistoricalKlines(
        symbol.toUpperCase(),
        interval as string,
        new Date(startTime).toISOString(),
        new Date(endTime).toISOString(),
        limit
      )
    }

    // ⭐ STEP 3: Transform ClickHouse format to frontend format
    // Reverse the array since we got DESC order (newest first) but charts need ASC (oldest first)
    const formattedKlines = clickhouseData.reverse().map((kline: any) => {
      // ClickHouse query already returns milliseconds (toUnixTimestamp * 1000)
      return {
        openTime: Number(kline.open_time),  // Already in milliseconds
        open: String(kline.open_price),
        high: String(kline.high_price),
        low: String(kline.low_price),
        close: String(kline.close_price),
        volume: String(kline.volume),
        closeTime: Number(kline.close_time),  // Already in milliseconds
        quoteVolume: String(kline.quote_volume),
        tradesCount: kline.trades_count,
        takerBuyBaseVolume: String(kline.taker_buy_base_volume),
        takerBuyQuoteVolume: String(kline.taker_buy_quote_volume)
      }
    })

    logger.info(`✅ Returning ${formattedKlines.length} klines from ClickHouse`)

    res.status(200).json({
      success: true,
      message: `Kline data for ${symbol} from ClickHouse`,
      data: {
        symbol: symbol.toUpperCase(),
        interval,
        period,
        klines: formattedKlines,
        total: formattedKlines.length,
        source: 'clickhouse' // Indicate data source
      },
    });
  } catch (error: any) {
    logger.error(`❌ Error fetching klines for ${symbol}:`, error);
    res.status(500).json({
      success: false,
      message: `Failed to fetch klines for ${symbol}`,
      error: error.message,
    });
  }
}));

export { router as marketDataRoutes };
