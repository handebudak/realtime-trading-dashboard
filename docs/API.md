# 📡 API Documentation

Complete REST API documentation for the Trading Dashboard backend.

**Base URL:** `http://localhost:3002/api/v1` (development)  
**Production:** `https://api.yourdomain.com/api/v1`

---

## Table of Contents

1. [Authentication](#authentication)
2. [Market Data](#market-data)
3. [Trading](#trading)
4. [System](#system)
5. [Charts](#charts)
6. [Error Handling](#error-handling)
7. [Rate Limiting](#rate-limiting)

---

## Authentication

### POST /auth/register

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

**Response:** `201 Created`
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": 1,
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "createdAt": "2024-01-01T12:00:00.000Z"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
}
```

**Validation Rules:**
- `email`: Valid email format, unique
- `password`: Min 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special char
- `firstName`: 2-50 characters
- `lastName`: 2-50 characters

---

### POST /auth/login

Login with email and password.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Login successful",
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

**Errors:**
- `401`: Invalid credentials
- `404`: User not found

---

### POST /auth/refresh

Refresh access token using refresh token.

**Request:**
```json
{
  "refreshToken": "eyJhbGc..."
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc..."
  }
}
```

---

## Market Data

### GET /market-data/klines

Get historical klines (candlesticks).

**Query Parameters:**
- `symbol` (required): Trading pair (e.g., BTCUSDT)
- `interval` (required): Timeframe (1m, 5m, 15m, 1h, 4h, 1d)
- `limit` (optional): Number of klines (default: 500, max: 1000)
- `startTime` (optional): Start time in milliseconds
- `endTime` (optional): End time in milliseconds

**Example:**
```
GET /api/v1/market-data/klines?symbol=BTCUSDT&interval=15m&limit=150
```

**Response:** `200 OK`
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

**Data Sources:**
- `clickhouse`: From ClickHouse database (primary)
- `binance`: Direct from Binance API (backfill)

---

### GET /market-data/ticker

Get 24-hour ticker statistics.

**Query Parameters:**
- `symbol` (required): Trading pair

**Example:**
```
GET /api/v1/market-data/ticker?symbol=BTCUSDT
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "symbol": "BTCUSDT",
    "priceChange": "1250.50",
    "priceChangePercent": "1.85",
    "lastPrice": "67550.25",
    "highPrice": "68000.00",
    "lowPrice": "66000.00",
    "volume": "12345.67",
    "quoteVolume": "835417890.12",
    "openTime": 1729301400000,
    "closeTime": 1729387800000,
    "firstId": 123456789,
    "lastId": 123789456,
    "count": 332667
  }
}
```

---

## Trading

**Authentication Required:** All trading endpoints require `Authorization: Bearer <accessToken>` header.

### POST /trading/orders

Create a new order.

**Request:**
```json
{
  "symbol": "BTCUSDT",
  "side": "BUY",
  "type": "MARKET",
  "quantity": "0.001"
}
```

**Request (Limit Order):**
```json
{
  "symbol": "BTCUSDT",
  "side": "SELL",
  "type": "LIMIT",
  "quantity": "0.001",
  "price": "68000.00"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "message": "Order created successfully",
  "data": {
    "order": {
      "id": 123,
      "userId": 1,
      "symbol": "BTCUSDT",
      "side": "BUY",
      "type": "MARKET",
      "quantity": "0.001",
      "price": "67550.25",
      "status": "FILLED",
      "filledQuantity": "0.001",
      "averagePrice": "67550.25",
      "createdAt": "2024-01-01T12:00:00.000Z",
      "updatedAt": "2024-01-01T12:00:00.100Z"
    }
  }
}
```

**Validation:**
- `symbol`: Valid trading pair
- `side`: BUY or SELL
- `type`: MARKET, LIMIT, or STOP
- `quantity`: Positive number
- `price`: Required for LIMIT orders

**Errors:**
- `400`: Invalid input
- `401`: Unauthorized
- `403`: Insufficient balance
- `500`: Order execution failed

---

### GET /trading/orders

Get user orders.

**Query Parameters:**
- `status` (optional): PENDING, FILLED, CANCELLED, REJECTED
- `symbol` (optional): Filter by symbol
- `limit` (optional): Default 100, max 1000
- `offset` (optional): Default 0

**Example:**
```
GET /api/v1/trading/orders?status=FILLED&limit=50
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "id": 123,
        "symbol": "BTCUSDT",
        "side": "BUY",
        "type": "MARKET",
        "quantity": "0.001",
        "price": "67550.25",
        "status": "FILLED",
        "filledQuantity": "0.001",
        "averagePrice": "67550.25",
        "createdAt": "2024-01-01T12:00:00.000Z",
        "updatedAt": "2024-01-01T12:00:00.100Z"
      }
    ],
    "total": 1,
    "pagination": {
      "limit": 50,
      "offset": 0
    }
  }
}
```

---

### GET /trading/orders/:orderId

Get specific order details.

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "order": {
      "id": 123,
      "symbol": "BTCUSDT",
      "side": "BUY",
      "type": "MARKET",
      "quantity": "0.001",
      "price": "67550.25",
      "status": "FILLED",
      "filledQuantity": "0.001",
      "averagePrice": "67550.25",
      "createdAt": "2024-01-01T12:00:00.000Z",
      "updatedAt": "2024-01-01T12:00:00.100Z"
    }
  }
}
```

---

### DELETE /trading/orders/:orderId

Cancel a pending order.

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Order cancelled successfully",
  "data": {
    "orderId": 123,
    "status": "CANCELLED"
  }
}
```

**Errors:**
- `404`: Order not found
- `400`: Order cannot be cancelled (already filled/cancelled)

---

### GET /trading/positions

Get user positions.

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "positions": [
      {
        "id": 1,
        "symbol": "BTCUSDT",
        "side": "LONG",
        "quantity": "0.001",
        "entryPrice": "67550.25",
        "currentPrice": "67600.00",
        "unrealizedPnl": "0.0498",
        "createdAt": "2024-01-01T12:00:00.000Z",
        "updatedAt": "2024-01-01T13:00:00.000Z"
      }
    ],
    "total": 1
  }
}
```

---

### GET /trading/balance

Get user balance.

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "balances": [
      {
        "asset": "USDT",
        "available": "10000.00",
        "locked": "67.55",
        "total": "10067.55"
      },
      {
        "asset": "BTC",
        "available": "0.001",
        "locked": "0.000",
        "total": "0.001"
      }
    ]
  }
}
```

---

### GET /trading/trades

Get user trade history.

**Query Parameters:**
- `symbol` (optional): Filter by symbol
- `limit` (optional): Default 100, max 1000
- `offset` (optional): Default 0

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "trades": [
      {
        "id": 1,
        "orderId": 123,
        "symbol": "BTCUSDT",
        "side": "BUY",
        "quantity": "0.001",
        "price": "67550.25",
        "fee": "0.00",
        "createdAt": "2024-01-01T12:00:00.000Z"
      }
    ],
    "total": 1
  }
}
```

---

## System

### GET /system/status

Get system health status.

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "uptime": 86400,
    "memory": {
      "rss": 123456789,
      "heapTotal": 67890123,
      "heapUsed": 45678901,
      "external": 1234567
    },
    "cpu": {
      "user": 123456,
      "system": 56789
    },
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

---

### GET /system/metrics

Get system performance metrics.

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "performance": {
      "latency": 8.5,
      "throughput": 450.2,
      "errorRate": 0.2,
      "uptime": 12.5
    },
    "requests": {
      "total": 54321,
      "errors": 108,
      "successRate": 99.8
    },
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

---

### GET /system/alerts

Get system alerts.

**Query Parameters:**
- `acknowledged` (optional): true/false
- `severity` (optional): LOW, MEDIUM, HIGH, CRITICAL
- `type` (optional): LATENCY, ERROR_RATE, THROUGHPUT, WEBSOCKET

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "alerts": [
      {
        "id": "alert_1729387800_abc123",
        "type": "LATENCY",
        "severity": "CRITICAL",
        "message": "Critical latency: 105.23ms (threshold: 100ms)",
        "value": 105.23,
        "threshold": 100,
        "timestamp": "2024-01-01T12:00:00.000Z",
        "acknowledged": false
      }
    ],
    "unacknowledgedCount": 1,
    "total": 1,
    "thresholds": {
      "latency": {
        "warning": 50,
        "critical": 100
      },
      "errorRate": {
        "warning": 1,
        "critical": 5
      },
      "throughput": {
        "warning": 100,
        "critical": 50
      },
      "websocketConnections": {
        "warning": 500,
        "critical": 1000
      }
    }
  }
}
```

---

### POST /system/alerts/:alertId/acknowledge

Acknowledge an alert.

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Alert alert_1729387800_abc123 acknowledged",
  "data": {
    "alertId": "alert_1729387800_abc123",
    "status": "acknowledged",
    "timestamp": "2024-01-01T12:01:00.000Z"
  }
}
```

---

### POST /system/alerts/acknowledge-all

Acknowledge all alerts.

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "All alerts acknowledged",
  "data": {
    "timestamp": "2024-01-01T12:01:00.000Z"
  }
}
```

---

## Charts

### GET /charts/historical

Get chart data for historical analysis.

**Query Parameters:**
- `symbol` (required): Trading pair
- `interval` (required): 1m, 5m, 15m, 1h, 4h, 1d
- `strategy` (optional): scalping, day_trading, swing_trading, position_trading, long_term
- `limit` (optional): Number of candles

**Response:** Similar to `/market-data/klines`

---

## Error Handling

### Error Response Format

```json
{
  "success": false,
  "message": "Error message",
  "error": {
    "code": "ERROR_CODE",
    "message": "Detailed error message",
    "details": {}
  }
}
```

### Common Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Input validation failed |
| `AUTHENTICATION_ERROR` | Invalid or missing credentials |
| `AUTHORIZATION_ERROR` | Insufficient permissions |
| `NOT_FOUND` | Resource not found |
| `DUPLICATE_ERROR` | Resource already exists |
| `INSUFFICIENT_BALANCE` | Not enough balance |
| `ORDER_EXECUTION_FAILED` | Order execution error |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `INTERNAL_ERROR` | Server error |

### HTTP Status Codes

- `200 OK`: Successful GET, PUT, PATCH, DELETE
- `201 Created`: Successful POST
- `400 Bad Request`: Validation error
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `409 Conflict`: Duplicate resource
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error
- `503 Service Unavailable`: Service unavailable

---

## Rate Limiting

### Limits

- **Default:** 100 requests per 15 minutes per IP
- **Sensitive Endpoints:** 10 requests per minute
  - `/auth/login`
  - `/auth/register`
  - `/trading/orders` (POST)

### Rate Limit Headers

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1729388700
```

### Rate Limit Exceeded Response

```json
{
  "success": false,
  "message": "Too many requests",
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Try again in 60 seconds.",
    "retryAfter": 60
  }
}
```

---

## WebSocket API

### Connection

```javascript
const ws = new WebSocket('ws://localhost:3002/ws?symbol=BTCUSDT&token=<accessToken>')
```

### Message Types

**Kline Update:**
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
    "isClosed": false
  },
  "timestamp": 1729388000000
}
```

**Status:**
```json
{
  "type": "status",
  "message": "subscribed",
  "symbol": "BTCUSDT"
}
```

**Ping (Client → Server):**
```json
{
  "type": "ping",
  "timestamp": 1729388000000
}
```

**Pong (Server → Client):**
```json
{
  "type": "pong",
  "timestamp": 1729388000123
}
```

---

## Pagination

Standard pagination parameters:

- `limit`: Number of items per page (default: 100, max: 1000)
- `offset`: Number of items to skip (default: 0)

**Response includes:**
```json
{
  "pagination": {
    "total": 1000,
    "limit": 100,
    "offset": 0,
    "hasMore": true
  }
}
```

---

## Versioning

API version is included in the URL: `/api/v1/...`

Future versions: `/api/v2/...`

---

## SDK Examples

### JavaScript/TypeScript

```typescript
import axios from 'axios'

const api = axios.create({
  baseURL: 'http://localhost:3002/api/v1',
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
})

// Get klines
const klines = await api.get('/market-data/klines', {
  params: {
    symbol: 'BTCUSDT',
    interval: '15m',
    limit: 150
  }
})

// Create order
const order = await api.post('/trading/orders', {
  symbol: 'BTCUSDT',
  side: 'BUY',
  type: 'MARKET',
  quantity: '0.001'
})
```

---

## Postman Collection

**Coming Soon:** Download Postman collection from `/docs/postman/Trading-Dashboard-API.json`

---

**Questions?** Contact: api@trading-dashboard.com

