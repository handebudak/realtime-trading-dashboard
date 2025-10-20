# ⚙️ Trading Dashboard Backend

High-performance REST API and WebSocket server for real-time trading operations.

---

## 📚 Tech Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| Node.js | 18+ | Runtime environment |
| Express.js | 4.x | Web framework |
| TypeScript | 5.x | Type safety |
| PostgreSQL | 13+ | Transactional database |
| ClickHouse | 22+ | Analytics database |
| Redis | 6+ | Caching & rate limiting |
| WebSocket (ws) | 8.x | Real-time communication |
| JWT | 9.x | Authentication |
| Winston | 3.x | Logging |

---

## 📁 Project Structure

```
backend/
├── src/
│   ├── config/                    # Configuration
│   │   ├── database.ts           # DB connections
│   │   └── environment.ts        # Env variables
│   │
│   ├── routes/                    # API Routes
│   │   ├── auth.ts               # Authentication (login, register)
│   │   ├── trading.ts            # Trading operations (orders, positions)
│   │   ├── marketData.ts         # Market data (klines, ticker)
│   │   ├── charts.ts             # Chart data endpoints
│   │   ├── system.ts             # System metrics & alerts
│   │   └── index.ts              # Route aggregation
│   │
│   ├── services/                  # Business Logic
│   │   ├── authService.ts        # Authentication logic
│   │   ├── tradingService.ts     # Order & position management
│   │   ├── binanceService.ts     # Binance API client
│   │   ├── clickhouseService.ts  # ClickHouse operations
│   │   ├── backfillService.ts    # Historical data backfill
│   │   ├── alertService.ts       # Alert system
│   │   └── websocket.ts          # WebSocket server
│   │
│   ├── middleware/                # Middleware
│   │   ├── auth.ts               # JWT verification
│   │   ├── errorHandler.ts       # Error handling
│   │   └── rateLimiter.ts        # Rate limiting
│   │
│   ├── utils/                     # Utilities
│   │   ├── logger.ts             # Winston logger
│   │   └── validation.ts         # Input validation (Joi)
│   │
│   ├── types/                     # TypeScript types
│   │   └── index.ts
│   │
│   └── index.ts                   # Server entry point
│
├── dist/                          # Compiled JavaScript
├── logs/                          # Log files
│   ├── app.log
│   └── error.log
│
├── clickhouse_setup.sql           # ClickHouse schema
├── docker-compose.yml             # Database containers
├── package.json                   # Dependencies
├── tsconfig.json                  # TypeScript config
└── README.md                      # This file
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** >= 18.0.0
- **PostgreSQL** >= 13
- **ClickHouse** >= 22
- **Redis** >= 6
- **Docker** (optional, for databases)

### Installation

```bash
# Install dependencies
npm install

# Start databases (Docker)
docker-compose up -d

# Initialize ClickHouse schema
docker exec -i trading-clickhouse clickhouse-client -d trading_db < clickhouse_setup.sql

# Start development server
npm run dev
```

### Environment Variables

Create a `.env` file:

```env
# Server
PORT=3002
NODE_ENV=development

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_ACCESS_EXPIRY=24h
JWT_REFRESH_EXPIRY=7d

# PostgreSQL
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=trading_user
POSTGRES_PASSWORD=trading_password
POSTGRES_DATABASE=trading_db

# ClickHouse
CLICKHOUSE_HOST=http://localhost
CLICKHOUSE_PORT=8123
CLICKHOUSE_DATABASE=trading_db
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Binance
BINANCE_API_URL=https://api.binance.com
BINANCE_WS_URL=wss://stream.binance.com:9443/ws

# CORS
CORS_ORIGIN=http://localhost:3000

# Backfill
SKIP_BACKFILL=false
```

---

## 📡 API Endpoints

### Authentication

#### POST /api/v1/auth/register
Register a new user.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": 1,
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe"
    },
    "tokens": {
      "accessToken": "eyJhbGc...",
      "refreshToken": "eyJhbGc..."
    }
  }
}
```

#### POST /api/v1/auth/login
Login with email and password.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response:** Same as register

---

### Trading

#### POST /api/v1/trading/orders
Create a new order.

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Request:**
```json
{
  "symbol": "BTCUSDT",
  "side": "BUY",
  "type": "MARKET",
  "quantity": "0.001"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Order created successfully",
  "data": {
    "order": {
      "id": 123,
      "symbol": "BTCUSDT",
      "side": "BUY",
      "type": "MARKET",
      "quantity": "0.001",
      "status": "FILLED",
      "averagePrice": "67500.50",
      "createdAt": "2024-01-01T12:00:00Z"
    }
  }
}
```

#### GET /api/v1/trading/orders
Get user orders.

**Query Params:**
- `status` (optional): PENDING, FILLED, CANCELLED
- `symbol` (optional): BTCUSDT, ETHUSDT, etc.
- `limit` (optional): Default 100
- `offset` (optional): Default 0

#### GET /api/v1/trading/positions
Get user positions.

#### GET /api/v1/trading/balance
Get user balance.

#### GET /api/v1/trading/trades
Get user trade history.

---

### Market Data

#### GET /api/v1/market-data/klines
Get historical klines (candlesticks).

**Query Params:**
- `symbol` (required): BTCUSDT, ETHUSDT, etc.
- `interval` (required): 1m, 5m, 15m, 1h, 4h, 1d
- `limit` (optional): Default 500, max 1000
- `startTime` (optional): Unix timestamp (milliseconds)
- `endTime` (optional): Unix timestamp (milliseconds)

**Response:**
```json
{
  "success": true,
  "message": "Kline data for BTCUSDT from ClickHouse",
  "data": {
    "symbol": "BTCUSDT",
    "interval": "15m",
    "klines": [
      {
        "openTime": 1729387800000,
        "open": "67500.50",
        "high": "67600.00",
        "low": "67450.00",
        "close": "67550.25",
        "volume": "123.456",
        "closeTime": 1729388700000,
        "quoteVolume": "8345123.45",
        "tradesCount": 1250,
        "takerBuyBaseVolume": "65.234",
        "takerBuyQuoteVolume": "4401234.12"
      }
    ],
    "total": 150,
    "source": "clickhouse"
  }
}
```

#### GET /api/v1/market-data/ticker
Get current ticker (24hr price stats).

---

### System

#### GET /api/v1/system/status
Get system status.

#### GET /api/v1/system/metrics
Get system performance metrics.

**Response:**
```json
{
  "success": true,
  "data": {
    "performance": {
      "latency": 8.5,        // ms
      "throughput": 450.2,   // req/s
      "errorRate": 0.2,      // %
      "uptime": 12.5         // hours
    },
    "requests": {
      "total": 54321,
      "errors": 108,
      "successRate": 99.8
    }
  }
}
```

#### GET /api/v1/system/alerts
Get system alerts.

**Query Params:**
- `acknowledged` (optional): true/false
- `severity` (optional): LOW, MEDIUM, HIGH, CRITICAL
- `type` (optional): LATENCY, ERROR_RATE, THROUGHPUT, WEBSOCKET

#### POST /api/v1/system/alerts/:alertId/acknowledge
Acknowledge an alert.

#### POST /api/v1/system/alerts/acknowledge-all
Acknowledge all alerts.

---

## 🔌 WebSocket

### Connection

```javascript
const ws = new WebSocket('ws://localhost:3002/ws?symbol=BTCUSDT&token=<accessToken>')
```

### Messages

**Server → Client (Kline Update):**
```json
{
  "type": "kline",
  "symbol": "BTCUSDT",
  "data": {
    "openTime": 1729387800000,
    "closeTime": 1729388700000,
    "open": "67500.50",
    "high": "67600.00",
    "low": "67450.00",
    "close": "67550.25",
    "volume": "123.456",
    "quoteVolume": "8345123.45",
    "tradesCount": 1250,
    "takerBuyBaseVolume": "65.234",
    "takerBuyQuoteVolume": "4401234.12",
    "isClosed": false
  },
  "timestamp": 1729388000000
}
```

**Client → Server (Ping for Latency):**
```json
{
  "type": "ping",
  "timestamp": 1729388000000
}
```

**Server → Client (Pong Response):**
```json
{
  "type": "pong",
  "timestamp": 1729388000123
}
```

---

## 🗄️ Database Schemas

### PostgreSQL

See [database migrations](./migrations/) for complete schema.

**Key Tables:**
- `users` - User accounts
- `orders` - Order records
- `trades` - Executed trades
- `balances` - User balances
- `positions` - Open positions

### ClickHouse

See [clickhouse_setup.sql](./clickhouse_setup.sql) for complete schema.

**Key Tables:**
- `market_data` - Historical klines (partitioned by month)
- `trades` - Historical trades

---

## ⚡ Performance

### Metrics

- **Average Latency:** 8-15ms
- **Throughput:** 400-600 req/s
- **Error Rate:** < 0.5%
- **WebSocket Latency:** 50-100ms

### Optimizations

1. **Database Connection Pooling**
   - PostgreSQL: 20 connections
   - ClickHouse: HTTP client reuse

2. **Redis Caching**
   - Market data: 5-minute TTL
   - User balance: 1-minute TTL

3. **Batch Processing**
   - ClickHouse inserts every 10 seconds
   - 50-200 klines per batch

4. **Query Optimization**
   - Indexes on foreign keys
   - ClickHouse partitioning by month

---

## 🔒 Security

### Authentication
- JWT with HS256 algorithm
- Access token: 24 hours
- Refresh token: 7 days

### Rate Limiting
- 100 requests per 15 minutes per IP
- Redis-based sliding window

### Input Validation
- Joi schemas for all inputs
- SQL injection prevention (parameterized queries)

### CORS
- Whitelist origins
- Credentials enabled

---

## 🧪 Testing

```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# Coverage
npm run test:coverage
```

---

## 📦 Build & Deploy

### Development
```bash
npm run dev
```

### Production
```bash
# Build
npm run build

# Start
npm start
```

### Docker
```bash
docker build -t trading-backend .
docker run -p 3002:3002 trading-backend
```

---

## 📝 Logging

Winston logger with multiple transports:

- **Console:** All logs (development)
- **app.log:** Info and above
- **error.log:** Error and above

**Log Levels:**
- `error` - Errors
- `warn` - Warnings
- `info` - General info
- `debug` - Debug info (development)

---

## 🔮 Future Enhancements

- [ ] PostgreSQL read replicas
- [ ] ClickHouse cluster
- [ ] Redis Sentinel for HA
- [ ] GraphQL API
- [ ] gRPC for microservices
- [ ] Kafka for event streaming

---

## 📞 Support

- **Email:** support@trading-dashboard.com
- **Issues:** GitHub Issues
- **Docs:** [Main README](../README.md)

---

Made with ⚡ using Node.js & TypeScript
