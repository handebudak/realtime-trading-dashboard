import axios from 'axios';
import WebSocket from 'ws';
import { logger, throttledLogPerKey } from '../utils/logger';

interface BinanceKline {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
  quoteAssetVolume: string;
  numberOfTrades: number;
  takerBuyBaseAssetVolume: string;
  takerBuyQuoteAssetVolume: string;
  ignore: string;
}

interface BinanceTrade {
  id: number;
  price: string;
  qty: string;
  quoteQty: string;
  time: number;
  isBuyerMaker: boolean;
  isBestMatch: boolean;
}

interface Binance24hrTicker {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  weightedAvgPrice: string;
  prevClosePrice: string;
  lastPrice: string;
  lastQty: string;
  bidPrice: string;
  askPrice: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  openTime: number;
  closeTime: number;
  firstId: number;
  lastId: number;
  count: number;
}

class BinanceService {
  private baseURL = 'https://api.binance.com/api/v3';
  private wsBaseURL = 'wss://stream.binance.com:9443/ws';
  private rateLimitDelay = 100; // 100ms delay between requests
  private ws: WebSocket | null = null;
  private callbacks: Map<string, (data: any) => void> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async makeRequest<T>(endpoint: string, params: Record<string, any> = {}): Promise<T> {
    try {
      await this.delay(this.rateLimitDelay);
      
      const response = await axios.get(`${this.baseURL}${endpoint}`, {
        params,
        timeout: 10000,
        headers: {
          'User-Agent': 'TradingDashboard/1.0'
        }
      });

      return response.data;
    } catch (error: any) {
      console.error(`Binance API Error (${endpoint}):`, error.message);
      throw new Error(`Failed to fetch data from Binance: ${error.message}`);
    }
  }

  // Get kline/candlestick data
  async getKlines(
    symbol: string,
    interval: string = '1h',
    startTime?: number,
    endTime?: number,
    limit: number = 1000
  ): Promise<BinanceKline[]> {
    const params: Record<string, any> = {
      symbol: symbol.toUpperCase(),
      interval,
      limit
    };

    if (startTime) params['startTime'] = startTime;
    if (endTime) params['endTime'] = endTime;

    return this.makeRequest<BinanceKline[]>('/klines', params);
  }

  // Get recent trades
  async getRecentTrades(
    symbol: string,
    limit: number = 1000
  ): Promise<BinanceTrade[]> {
    const params = {
      symbol: symbol.toUpperCase(),
      limit
    };

    return this.makeRequest<BinanceTrade[]>('/trades', params);
  }

  // Get 24hr ticker statistics
  async get24hrTicker(symbol?: string): Promise<Binance24hrTicker | Binance24hrTicker[]> {
    const endpoint = symbol ? '/ticker/24hr' : '/ticker/24hr';
    const params = symbol ? { symbol: symbol.toUpperCase() } : {};

    return this.makeRequest<Binance24hrTicker | Binance24hrTicker[]>(endpoint, params);
  }

  // Get exchange info
  async getExchangeInfo(): Promise<any> {
    return this.makeRequest('/exchangeInfo');
  }

  // Get order book
  async getOrderBook(
    symbol: string,
    limit: number = 100
  ): Promise<any> {
    const params = {
      symbol: symbol.toUpperCase(),
      limit
    };

    return this.makeRequest('/depth', params);
  }

  // Get current average price
  async getAvgPrice(symbol: string): Promise<any> {
    const params = {
      symbol: symbol.toUpperCase()
    };

    return this.makeRequest('/avgPrice', params);
  }

  // Get all symbols
  async getAllSymbols(): Promise<string[]> {
    const exchangeInfo = await this.getExchangeInfo();
    return exchangeInfo.symbols
      .filter((symbol: any) => symbol.status === 'TRADING')
      .map((symbol: any) => symbol.symbol);
  }

  // Get popular trading pairs
  async getPopularSymbols(): Promise<string[]> {
    const tickers = await this.get24hrTicker() as Binance24hrTicker[];
    
    // Always include BTC, ETH, ADA first
    const prioritySymbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT'];
    
    const otherSymbols = tickers
      .filter(ticker => ticker.symbol.endsWith('USDT') && !prioritySymbols.includes(ticker.symbol))
      .sort((a, b) => parseFloat(b.volume) - parseFloat(a.volume))
      .slice(0, 7) // Get 7 more symbols
      .map(ticker => ticker.symbol);
    
    return [...prioritySymbols, ...otherSymbols];
  }

  // Initialize WebSocket connection
  private connect(): void {
    logger.info('🔄 Connecting to Binance WebSocket...');
    this.ws = new WebSocket(this.wsBaseURL);

    this.ws.on('open', () => {
      logger.info('✅ Connected to Binance WebSocket');
      
      // Resubscribe to all existing callbacks (bulk subscribe to avoid rate limit)
      if (this.callbacks.size > 0) {
        this.bulkSubscribe(Array.from(this.callbacks.keys()));
      }

      // Start heartbeat (ping every 30 seconds)
      this.startHeartbeat();
    });

    this.ws.on('message', (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());
        
        // Check if it's a ticker update (has symbol field)
        if (data.s) {
          const symbol = data.s.toLowerCase();
          const callback = this.callbacks.get(symbol);
          
          if (callback) {
            // Use throttled log per symbol (only logs each symbol once every 5 seconds)
            throttledLogPerKey(symbol, 'debug', `📊 Ticker data for ${data.s}`, {
              price: data.c,
              change: data.P + '%',
              volume: data.v
            });
            callback(data);
          }
        } else if (data.result === null) {
          // Subscription confirmation
          logger.info('✅ Subscription confirmed');
        } else {
          logger.debug('📨 Received message', data);
        }
      } catch (error) {
        logger.error('❌ Parse error', { error });
      }
    });

    this.ws.on('error', (error: Error) => {
      logger.error('❌ WebSocket error', { error });
    });

    this.ws.on('close', (code: number, reason: Buffer) => {
      logger.warn(`🔌 WebSocket closed (code: ${code}, reason: ${reason.toString()})`);
      this.stopHeartbeat();
      
      // Reconnect after 1 second
      logger.info('🔄 Reconnecting in 1 second...');
      this.reconnectTimeout = setTimeout(() => this.connect(), 1000);
    });

    this.ws.on('pong', () => {
      logger.debug('🏓 Pong received');
    });
  }

  // Start heartbeat to keep connection alive
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
        logger.debug('🏓 Ping sent');
      }
    }, 30000); // Every 30 seconds
  }

  // Stop heartbeat
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // Bulk subscribe to multiple symbols (to avoid rate limiting)
  private bulkSubscribe(symbols: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      logger.warn('⚠️ WebSocket not ready, will subscribe when connected');
      return;
    }

    const params = symbols.map(symbol => `${symbol}@ticker`);
    const subscribeMsg = {
      method: 'SUBSCRIBE',
      params: params,
      id: Date.now()
    };

    this.ws.send(JSON.stringify(subscribeMsg));
    logger.info(`📡 Bulk subscribed to ${symbols.length} symbols: ${symbols.join(', ')}`);
  }

  // Subscribe to a single symbol's ticker stream
  private subscribe(symbol: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      logger.warn('⚠️ WebSocket not ready, will subscribe when connected');
      return;
    }

    const subscribeMsg = {
      method: 'SUBSCRIBE',
      params: [`${symbol}@ticker`],
      id: Date.now()
    };

    this.ws.send(JSON.stringify(subscribeMsg));
    logger.info(`📡 Subscribed to ${symbol}@ticker`);
  }

  // Public method to subscribe to ticker updates
  subscribeToTicker(symbol: string, callback: (data: any) => void): void {
    const lowerSymbol = symbol.toLowerCase();
    this.callbacks.set(lowerSymbol, callback);

    // Connect if not already connected
    if (!this.ws) {
      this.connect();
    } else if (this.ws.readyState === WebSocket.OPEN) {
      this.subscribe(lowerSymbol);
    }
    // If connecting, subscription will happen in 'open' event
  }

  // Unsubscribe from a symbol's ticker stream
  unsubscribeFromTicker(symbol: string): void {
    const lowerSymbol = symbol.toLowerCase();
    this.callbacks.delete(lowerSymbol);

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const unsubscribeMsg = {
        method: 'UNSUBSCRIBE',
        params: [`${lowerSymbol}@ticker`],
        id: Date.now()
      };
      this.ws.send(JSON.stringify(unsubscribeMsg));
      logger.info(`🔇 Unsubscribed from ${symbol}@ticker`);
    }
  }

  // Close all WebSocket connections
  closeAllConnections(): void {
    this.stopHeartbeat();
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.callbacks.clear();
    logger.info('🔌 All WebSocket connections closed');
  }
}

export const binanceService = new BinanceService();
export default binanceService;
