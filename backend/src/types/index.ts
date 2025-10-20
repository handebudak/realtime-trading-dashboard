// Common types for the trading dashboard

export interface User {
  id: string;
  email: string;
  role: 'admin' | 'trader' | 'viewer';
  permissions: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface MarketData {
  symbol: string;
  price: string;
  change: string;
  changePercent: string;
  volume: string;
  high: string;
  low: string;
  timestamp: string;
}

export interface OrderBook {
  symbol: string;
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  timestamp: string;
}

export interface OrderBookEntry {
  price: string;
  quantity: string;
}

export interface Trade {
  id: string;
  symbol: string;
  price: string;
  quantity: string;
  side: 'buy' | 'sell';
  timestamp: string;
}

export interface Kline {
  openTime: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: string;
}

export interface Order {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop' | 'stop_limit';
  quantity: string;
  price?: string;
  stopPrice?: string;
  timeInForce: 'GTC' | 'IOC' | 'FOK';
  status: 'pending' | 'filled' | 'cancelled' | 'rejected';
  filledQuantity: string;
  averagePrice?: string;
  timestamp: string;
  updatedAt: string;
}

export interface Position {
  symbol: string;
  side: 'long' | 'short';
  size: string;
  entryPrice: string;
  markPrice: string;
  pnl: string;
  pnlPercent: string;
  timestamp: string;
}

export interface Balance {
  total: string;
  available: string;
  used: string;
  currencies: CurrencyBalance[];
}

export interface CurrencyBalance {
  currency: string;
  balance: string;
  available: string;
}

export interface SystemMetrics {
  latency: number;
  throughput: number;
  errorRate: number;
  timestamp: string;
}

export interface SystemAlert {
  id: string;
  type: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
  acknowledged?: boolean;
}

export interface PerformanceMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnL: string;
  averagePnL: string;
  maxDrawdown: string;
  sharpeRatio: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: {
    message: string;
    stack?: string;
  };
  timestamp: string;
  path?: string;
}

export interface PaginationParams {
  limit: number;
  offset: number;
  total?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationParams;
}

// WebSocket event types
export interface WebSocketEvents {
  'market-data:update': MarketData;
  'trading:update': Order | Trade;
  'system:alert': SystemAlert;
  'system:metrics': SystemMetrics;
  'ping': void;
  'pong': { timestamp: string };
  'error': { message: string };
}

// Database connection types
export interface DatabaseConnection {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
}

// JWT payload type
export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

// Request types with authentication
export interface AuthenticatedRequest extends Request {
  user?: User;
  token?: string;
}

// Environment configuration type
export interface Config {
  NODE_ENV: string;
  PORT: number;
  HOST: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  JWT_REFRESH_EXPIRES_IN: string;
  POSTGRES: DatabaseConnection;
  CLICKHOUSE: DatabaseConnection;
  REDIS: {
    HOST: string;
    PORT: number;
    PASSWORD: string;
    DB: number;
  };
  CORS: {
    ORIGIN: string;
    CREDENTIALS: boolean;
  };
  RATE_LIMIT: {
    WINDOW_MS: number;
    MAX_REQUESTS: number;
  };
  WS: {
    PORT: number;
    CORS_ORIGIN: string;
  };
  LOGGING: {
    LEVEL: string;
    FILE: string;
  };
  TRADING_SYSTEM: {
    URL: string;
    API_KEY: string;
  };
  MARKET_DATA: {
    PROVIDER: string;
    UPDATE_INTERVAL: number;
  };
}

