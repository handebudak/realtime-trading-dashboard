# 🏗️ System Architecture

This document describes the complete architecture of the Real-Time Trading Dashboard, including system components, data flow, and technical decisions.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Component Architecture](#component-architecture)
3. [Data Flow](#data-flow)
4. [Database Schema](#database-schema)
5. [WebSocket Architecture](#websocket-architecture)
6. [Security Architecture](#security-architecture)
7. [Performance Optimizations](#performance-optimizations)

---

## System Overview

### High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                              │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Browser    │  │    Mobile    │  │   Tablet     │         │
│  │  (Desktop)   │  │  (Responsive)│  │ (Responsive) │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
│         │                  │                  │                  │
│         └──────────────────┼──────────────────┘                 │
│                            │                                     │
└────────────────────────────┼─────────────────────────────────────┘
                             │
                   ┌─────────┴─────────┐
                   │                   │
            HTTP/HTTPS            WebSocket (ws://)
                   │                   │
┌──────────────────┼───────────────────┼─────────────────────────┐
│                  │                   │      FRONTEND LAYER      │
│                  ▼                   ▼                          │
│         ┌──────────────┐    ┌──────────────┐                  │
│         │   Next.js    │    │  WebSocket   │                  │
│         │   Server     │    │    Client    │                  │
│         │    (SSR)     │    │   (useWS)    │                  │
│         └──────┬───────┘    └──────┬───────┘                  │
│                │                    │                           │
│         ┌──────┴────────────────────┴───────┐                 │
│         │        React Components           │                 │
│         │  ┌─────┬──────┬────────┬───────┐ │                 │
│         │  │Auth │Charts│Trading │System │ │                 │
│         │  └─────┴──────┴────────┴───────┘ │                 │
│         └────────────────────────────────────┘                 │
└────────────────────────────────────────────────────────────────┘
                             │
                   ┌─────────┴─────────┐
                   │                   │
              REST API            WebSocket
                   │                   │
┌──────────────────┼───────────────────┼─────────────────────────┐
│                  │      BACKEND LAYER│                          │
│                  ▼                   ▼                          │
│         ┌──────────────┐    ┌──────────────┐                  │
│         │  Express.js  │    │  WebSocket   │                  │
│         │  REST API    │    │    Server    │                  │
│         │              │    │     (ws)     │                  │
│         └──────┬───────┘    └──────┬───────┘                  │
│                │                    │                           │
│         ┌──────┴────────────────────┴───────┐                 │
│         │         Services Layer            │                 │
│         │  ┌─────────┬────────┬──────────┐ │                 │
│         │  │ Trading │Binance │ClickHouse│ │                 │
│         │  │ Service │Service │ Service  │ │                 │
│         │  └─────────┴────────┴──────────┘ │                 │
│         └──────┬────────────────┬────────────┘                 │
│                │                │                               │
└────────────────┼────────────────┼───────────────────────────────┘
                 │                │
      ┌──────────┴─────┬──────────┴──────┬──────────┐
      │                │                 │          │
┌─────▼──────┐  ┌──────▼────┐  ┌────────▼────┐  ┌──▼─────┐
│ PostgreSQL │  │ ClickHouse│  │    Redis    │  │Binance │
│            │  │           │  │             │  │  API   │
│  Users     │  │  Market   │  │   Cache     │  │        │
│  Orders    │  │  Data     │  │   Rate      │  │ Real   │
│  Trades    │  │  Klines   │  │  Limiting   │  │ Time   │
│  Balances  │  │ Analytics │  │  Sessions   │  │ Data   │
└────────────┘  └───────────┘  └─────────────┘  └────────┘
```

---

## Component Architecture

### Frontend Architecture

```
frontend/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx           # Dashboard (Main)
│   │   ├── auth/              # Authentication pages
│   │   └── historical/        # Historical data page
│   │
│   ├── components/            # React Components
│   │   ├── Auth/             # Login, Register, Protected
│   │   ├── Charts/           # Trading charts
│   │   │   ├── DayTradingChart.tsx
│   │   │   ├── VolumeAnalysisChart.tsx
│   │   │   ├── RSIChart.tsx
│   │   │   └── ...
│   │   ├── Trading/          # Trading interface
│   │   │   ├── TradingInterface.tsx
│   │   │   └── RecentTrades.tsx
│   │   ├── System/           # System metrics
│   │   │   └── SystemMetrics.tsx
│   │   └── Layout/           # Layout components
│   │
│   ├── contexts/             # React Contexts
│   │   ├── AuthContext.tsx  # Authentication state
│   │   └── ThemeContext.tsx # Theme management
│   │
│   ├── hooks/                # Custom hooks
│   │   └── useWebSocket.ts  # WebSocket management
│   │
│   └── services/             # API services
│       └── authService.ts   # Auth API calls
│
└── public/                   # Static assets
```

### Backend Architecture

```
backend/
├── src/
│   ├── config/               # Configuration
│   │   ├── database.ts      # DB connections
│   │   └── environment.ts   # Env variables
│   │
│   ├── routes/              # API Routes
│   │   ├── auth.ts         # Authentication
│   │   ├── trading.ts      # Trading operations
│   │   ├── marketData.ts   # Market data
│   │   ├── charts.ts       # Chart data
│   │   └── system.ts       # System metrics
│   │
│   ├── services/            # Business Logic
│   │   ├── authService.ts  # Auth logic
│   │   ├── tradingService.ts # Order management
│   │   ├── binanceService.ts # Binance API
│   │   ├── clickhouseService.ts # ClickHouse ops
│   │   ├── websocket.ts    # WebSocket server
│   │   └── backfillService.ts # Data backfill
│   │
│   ├── middleware/          # Middleware
│   │   ├── auth.ts         # JWT verification
│   │   ├── errorHandler.ts # Error handling
│   │   └── rateLimiter.ts  # Rate limiting
│   │
│   ├── utils/               # Utilities
│   │   ├── logger.ts       # Winston logger
│   │   └── validation.ts   # Input validation
│   │
│   └── index.ts             # Server entry point
│
├── clickhouse_setup.sql     # ClickHouse schema
└── docker-compose.yml       # Database containers
```

---

## Data Flow

### 1. Real-Time Market Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Binance WebSocket API                     │
│                  wss://stream.binance.com                    │
└────────────────────────┬────────────────────────────────────┘
                         │ Real-time klines (1s updates)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│               Backend WebSocket Server                       │
│               (backend/src/services/websocket.ts)           │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  1. Receive kline from Binance                        │  │
│  │  2. Transform data format                             │  │
│  │  3. Broadcast to connected clients                    │  │
│  │  4. Buffer closed klines                              │  │
│  │  5. Batch insert to ClickHouse (every 10s)           │  │
│  └──────────────────────────────────────────────────────┘  │
└────────┬────────────────────────────────┬────────────────────┘
         │                                │
         │ WebSocket                      │ Batch Insert
         │                                │
         ▼                                ▼
┌──────────────────┐           ┌─────────────────────┐
│  Frontend        │           │   ClickHouse        │
│  useWebSocket    │           │   market_data       │
│                  │           │   table             │
│  1. Receive data │           │                     │
│  2. Update chart │           │  - symbol           │
│  3. Update state │           │  - interval         │
│                  │           │  - open_time        │
└──────────────────┘           │  - close_time       │
                               │  - price data       │
                               │  - volume           │
                               └─────────────────────┘
```

### 2. Historical Data Query Flow

```
┌────────────────────────────────────────────────────────────┐
│                  Frontend Chart Component                   │
│           (DayTradingChart, VolumeChart, RSI)              │
└────────────────────────┬───────────────────────────────────┘
                         │ HTTP GET /api/v1/market-data/klines
                         │ ?symbol=BTCUSDT&interval=15m&limit=150
                         ▼
┌────────────────────────────────────────────────────────────┐
│              Backend API (marketData.ts)                    │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐│
│  │  STEP 1: Check ClickHouse for data                     ││
│  │  ├─ Query: Get latest N klines                         ││
│  │  └─ If insufficient data (< 80%) → STEP 2              ││
│  │                                                          ││
│  │  STEP 2: Backfill from Binance (if needed)             ││
│  │  ├─ Fetch missing data from Binance API                ││
│  │  ├─ Insert into ClickHouse                             ││
│  │  └─ Query again                                         ││
│  │                                                          ││
│  │  STEP 3: Transform & return data                       ││
│  │  ├─ Convert timestamps to milliseconds                 ││
│  │  ├─ Format for frontend                                ││
│  │  └─ Return JSON response                               ││
│  └───────────────────────────────────────────────────────┘│
└────────────────────────┬───────────────────────────────────┘
                         │ JSON Response
                         │ { source: 'clickhouse', klines: [...] }
                         ▼
┌────────────────────────────────────────────────────────────┐
│                 Frontend Chart Component                    │
│                                                             │
│  1. Normalize timestamps (ensure milliseconds)             │
│  2. Transform to Chart.js format                           │
│  3. Render chart                                           │
│  4. Subscribe to WebSocket for real-time updates           │
└─────────────────────────────────────────────────────────────┘
```

### 3. Trade Execution Flow

```
┌─────────────────────────────────────────────────────────────┐
│              Frontend Trading Interface                      │
│           (TradingInterface.tsx)                            │
└────────────────────────┬────────────────────────────────────┘
                         │ POST /api/v1/trading/orders
                         │ { symbol, side, type, quantity, price }
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              Backend Trading Route                           │
│          (routes/trading.ts)                                │
│                                                              │
│  1. Authenticate user (JWT middleware)                      │
│  2. Validate input (Joi schema)                             │
│  3. Call tradingService.createOrder()                       │
└────────────────────────┬────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────┐
│           Trading Service (tradingService.ts)               │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐│
│  │ BEGIN TRANSACTION                                       ││
│  │                                                          ││
│  │ 1. Get current price from Binance                       ││
│  │ 2. Check user balance (PostgreSQL)                      ││
│  │    ├─ BUY: Check USDT balance >= quantity * price      ││
│  │    └─ SELL: Check asset balance >= quantity            ││
│  │                                                          ││
│  │ 3. Create order record (PostgreSQL orders table)        ││
│  │    └─ Status: PENDING                                   ││
│  │                                                          ││
│  │ 4. Lock balance                                          ││
│  │    ├─ Move from 'available' to 'locked'                ││
│  │    └─ UPDATE balances table                            ││
│  │                                                          ││
│  │ 5. If MARKET order:                                     ││
│  │    ├─ Execute immediately                               ││
│  │    ├─ Update order status to FILLED                     ││
│  │    ├─ Create trade record                               ││
│  │    ├─ Update balances (unlock & transfer)              ││
│  │    └─ Update/create position                           ││
│  │                                                          ││
│  │ COMMIT TRANSACTION                                       ││
│  └────────────────────────────────────────────────────────┘││
└────────────────────────┬────────────────────────────────────┘
                         │ Order object
                         │ { id, status: 'FILLED', ... }
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              Frontend Trading Interface                      │
│                                                              │
│  1. Display success message                                 │
│  2. Update UI (clear form)                                  │
│  3. Refresh balance                                         │
│  4. Refresh trade history                                   │
└──────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### PostgreSQL Schema (User & Trading Data)

```sql
-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Orders table
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    symbol VARCHAR(20) NOT NULL,
    side VARCHAR(10) NOT NULL CHECK (side IN ('BUY', 'SELL')),
    type VARCHAR(10) NOT NULL CHECK (type IN ('MARKET', 'LIMIT', 'STOP')),
    quantity DECIMAL(20, 8) NOT NULL,
    price DECIMAL(20, 8),
    status VARCHAR(20) NOT NULL CHECK (status IN ('PENDING', 'FILLED', 'CANCELLED', 'REJECTED')),
    filled_quantity DECIMAL(20, 8) DEFAULT 0,
    average_price DECIMAL(20, 8) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_symbol ON orders(symbol);
CREATE INDEX idx_orders_status ON orders(status);

-- Trades table
CREATE TABLE trades (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    order_id INTEGER REFERENCES orders(id),
    symbol VARCHAR(20) NOT NULL,
    side VARCHAR(10) NOT NULL,
    quantity DECIMAL(20, 8) NOT NULL,
    price DECIMAL(20, 8) NOT NULL,
    fee DECIMAL(20, 8) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Balances table
CREATE TABLE balances (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    asset VARCHAR(20) NOT NULL,
    available DECIMAL(20, 8) DEFAULT 0,
    locked DECIMAL(20, 8) DEFAULT 0,
    total DECIMAL(20, 8) GENERATED ALWAYS AS (available + locked) STORED,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, asset)
);

-- Positions table
CREATE TABLE positions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    symbol VARCHAR(20) NOT NULL,
    side VARCHAR(10) NOT NULL CHECK (side IN ('LONG', 'SHORT')),
    quantity DECIMAL(20, 8) NOT NULL,
    entry_price DECIMAL(20, 8) NOT NULL,
    current_price DECIMAL(20, 8),
    unrealized_pnl DECIMAL(20, 8) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, symbol, side)
);
```

### ClickHouse Schema (Historical Market Data)

```sql
-- Market data table (Klines/Candlesticks)
CREATE TABLE IF NOT EXISTS market_data (
    symbol String,
    interval String,
    open_time DateTime,
    close_time DateTime,
    open_price Float64,
    high_price Float64,
    low_price Float64,
    close_price Float64,
    volume Float64,
    quote_volume Float64,
    trades_count UInt32,
    taker_buy_base_volume Float64,
    taker_buy_quote_volume Float64,
    created_at DateTime DEFAULT now()
) ENGINE = MergeTree()
ORDER BY (symbol, interval, open_time)
PARTITION BY toYYYYMM(open_time); -- Monthly partitions

-- Trades table (Historical trades)
CREATE TABLE IF NOT EXISTS trades (
    id String,
    symbol String,
    price Float64,
    quantity Float64,
    side String,
    timestamp DateTime64(3),
    trade_id UInt64,
    buyer_order_id String,
    seller_order_id String,
    created_at DateTime DEFAULT now()
) ENGINE = MergeTree()
ORDER BY (symbol, timestamp)
PARTITION BY toYYYYMM(timestamp);
```

**Why ClickHouse?**
- **Columnar storage** - 10-100x faster for analytical queries
- **Compression** - 90% less storage than PostgreSQL
- **Partitioning** - Monthly partitions for efficient data pruning
- **Real-time inserts** - Handles 100K+ inserts/second

---

## WebSocket Architecture

### Connection Flow

```
┌──────────────────┐                          ┌─────────────────┐
│   Frontend       │                          │   Backend WS    │
│   (Browser)      │                          │     Server      │
└────────┬─────────┘                          └────────┬────────┘
         │                                              │
         │  1. WebSocket Handshake                     │
         │  ws://localhost:3002/ws?symbol=BTCUSDT&token=xxx
         ├─────────────────────────────────────────────>│
         │                                              │
         │  2. Verify JWT Token                        │
         │                                         ┌────▼─────┐
         │                                         │ Validate │
         │                                         │  Token   │
         │                                         └────┬─────┘
         │  3. WebSocket Connection Established         │
         │<─────────────────────────────────────────────┤
         │                                              │
         │                                         ┌────▼─────┐
         │                                         │ Connect  │
         │                                         │ Binance  │
         │                                         └────┬─────┘
         │                                              │
         │  4. Subscription Confirmed                   │
         │<─────────────────────────────────────────────┤
         │  { type: 'status', message: 'subscribed' }   │
         │                                              │
         │                                              │
         │  5. Real-time kline updates (continuous)     │
         │<─────────────────────────────────────────────┤
         │  { type: 'kline', data: {...}, timestamp }   │
         │<─────────────────────────────────────────────┤
         │<─────────────────────────────────────────────┤
         │                                              │
```

### WebSocket Message Format

**From Server to Client:**

```typescript
// Kline update
{
  type: 'kline',
  symbol: 'BTCUSDT',
  data: {
    openTime: 1729387800000,    // milliseconds
    closeTime: 1729388700000,
    open: '67500.50',
    high: '67600.00',
    low: '67450.00',
    close: '67550.25',
    volume: '123.456',
    quoteVolume: '8345123.45',
    tradesCount: 1250,
    takerBuyBaseVolume: '65.234',
    takerBuyQuoteVolume: '4401234.12',
    isClosed: false             // true when candle closes
  },
  timestamp: 1729388000000
}

// Status message
{
  type: 'status',
  message: 'subscribed',
  symbol: 'BTCUSDT'
}

// Error message
{
  type: 'error',
  message: 'Connection failed',
  code: 'WS_ERROR'
}
```

### Batch Insert Strategy

```
┌────────────────────────────────────────────────────────────┐
│            WebSocket Server (websocket.ts)                  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  Kline Buffer (In-Memory Array)                      │ │
│  │                                                        │ │
│  │  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐ │ │
│  │  │ k1   │  │ k2   │  │ k3   │  │ ...  │  │ kN   │ │ │
│  │  └──────┘  └──────┘  └──────┘  └──────┘  └──────┘ │ │
│  │                                                        │ │
│  │  Only CLOSED klines are buffered                      │ │
│  └──────────────────────┬───────────────────────────────┘ │
│                         │                                  │
│                    Every 10 seconds                        │
│                         │                                  │
│                         ▼                                  │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  flushKlineBuffer()                                   │ │
│  │  1. Check buffer length > 0                           │ │
│  │  2. Call clickhouseService.batchInsertMarketData()    │ │
│  │  3. Clear buffer                                       │ │
│  └──────────────────────┬───────────────────────────────┘ │
└────────────────────────┬┘                                  │
                         │                                   │
                         ▼                                   │
┌─────────────────────────────────────────────────────────┐ │
│         ClickHouseService.batchInsertMarketData()        │ │
│                                                           │ │
│  1. Filter duplicates (check existing open_time)         │ │
│  2. Transform data format                                │ │
│  3. INSERT INTO market_data VALUES (...)                 │ │
└───────────────────────────────────────────────────────────┘
```

**Why Batch Insert?**
- **Performance** - 100x faster than individual inserts
- **Network efficiency** - Reduced round trips
- **ClickHouse optimization** - Designed for batch operations
- **Buffer size** - Typically 50-200 klines per batch

---

## Security Architecture

### Authentication Flow

```
┌──────────────┐                              ┌─────────────┐
│   Browser    │                              │   Backend   │
└──────┬───────┘                              └──────┬──────┘
       │                                             │
       │  1. POST /api/v1/auth/login                │
       │  { email, password }                        │
       ├────────────────────────────────────────────>│
       │                                        ┌────▼─────┐
       │                                        │ Hash pwd │
       │                                        │ Compare  │
       │                                        └────┬─────┘
       │  2. JWT Tokens                              │
       │<────────────────────────────────────────────┤
       │  { accessToken, refreshToken }              │
       │                                             │
       │  3. Store in localStorage                   │
       │  localStorage.setItem('auth_tokens', ...)   │
       │                                             │
       │  4. Subsequent requests                     │
       │  Authorization: Bearer <accessToken>        │
       ├────────────────────────────────────────────>│
       │                                        ┌────▼─────┐
       │                                        │ Verify   │
       │                                        │ JWT      │
       │                                        └────┬─────┘
       │  5. Protected resource                      │
       │<────────────────────────────────────────────┤
       │                                             │
```

### Security Layers

1. **JWT Authentication**
   - Access token (24h expiry)
   - Refresh token (7 days expiry)
   - HS256 algorithm
   - Token stored in localStorage

2. **Rate Limiting** (Redis-based)
   - 100 requests per 15 minutes per IP
   - Sliding window algorithm
   - Custom limits for sensitive endpoints

3. **CORS**
   - Whitelist origins
   - Credentials: true
   - Preflight caching

4. **Helmet.js Security Headers**
   - Content-Security-Policy
   - X-Frame-Options: DENY
   - X-Content-Type-Options: nosniff
   - Strict-Transport-Security

5. **Input Validation**
   - Joi schemas for all inputs
   - SQL injection prevention (parameterized queries)
   - XSS protection

---

## Performance Optimizations

### Frontend Optimizations

1. **React Performance**
   ```typescript
   // Memoization
   const expensiveValue = useMemo(() => calculateRSI(data, 14), [data]);
   const handleClick = useCallback(() => {...}, [deps]);
   
   // Component memoization
   export default React.memo(VolumeChart);
   
   // Ref-based updates (avoid re-renders)
   chartRef.current.update('none'); // No animation
   ```

2. **Chart.js Optimizations**
   ```typescript
   // Configuration
   options: {
     animation: false,           // Disable animations
     parsing: false,             // Manual data parsing
     normalized: true,           // Pre-normalized data
     spanGaps: false,           // Don't fill gaps
     elements: {
       point: { radius: 0 }     // No point rendering
     }
   }
   ```

3. **WebSocket Optimizations**
   - Only update on closed candles
   - Duplicate prevention
   - Imperative chart updates
   - Connection pooling

### Backend Optimizations

1. **Database**
   - **PostgreSQL indexes** on user_id, symbol, status
   - **ClickHouse partitioning** by month
   - **Query optimization** - Avoid SELECT *
   - **Connection pooling** - Reuse connections

2. **Caching (Redis)**
   ```typescript
   // Cache strategy
   - Chart data: 5-minute TTL
   - User balance: 1-minute TTL
   - Market symbols: 1-hour TTL
   ```

3. **API Response**
   - Compression (gzip)
   - Pagination (limit/offset)
   - Selective fields
   - Batch operations

---

## Deployment Architecture

### Production Setup

```
┌─────────────────────────────────────────────────────────┐
│                     Load Balancer                        │
│                       (Nginx)                            │
└────────────┬────────────────────────┬────────────────────┘
             │                        │
    ┌────────▼────────┐      ┌────────▼────────┐
    │  Frontend       │      │  Frontend       │
    │  Next.js        │      │  Next.js        │
    │  (Server 1)     │      │  (Server 2)     │
    └────────┬────────┘      └────────┬────────┘
             │                        │
             └────────────┬───────────┘
                          │
                ┌─────────▼──────────┐
                │   Backend API      │
                │   (Express)        │
                └─────────┬──────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
   ┌────▼─────┐    ┌──────▼──────┐   ┌─────▼──────┐
   │PostgreSQL│    │ ClickHouse  │   │   Redis    │
   │ Primary  │    │   Cluster   │   │   Master   │
   └────┬─────┘    └──────┬──────┘   └─────┬──────┘
        │                 │                 │
   ┌────▼─────┐    ┌──────▼──────┐   ┌─────▼──────┐
   │PostgreSQL│    │ ClickHouse  │   │   Redis    │
   │ Replica  │    │   Replica   │   │   Slave    │
   └──────────┘    └─────────────┘   └────────────┘
```

---

## Monitoring & Logging

### Logging Strategy

```typescript
// Winston logger configuration
{
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({ format: winston.format.simple() })
  ]
}
```

### Metrics Tracked

- **Latency** - Request/response time
- **Throughput** - Requests per second
- **Error rate** - Failed requests percentage
- **WebSocket connections** - Active connections
- **Database query time** - Slow query detection
- **Memory usage** - Heap/RSS monitoring

---

## Conclusion

This architecture is designed for:
- **Low latency** - <10ms for real-time updates
- **High throughput** - 10K+ requests/second
- **Scalability** - Horizontal scaling capability
- **Reliability** - 99.9% uptime
- **Security** - Enterprise-grade protection
- **Maintainability** - Clean separation of concerns

For implementation details, see [TECHNICAL_PROPOSAL.md](./TECHNICAL_PROPOSAL.md).

