-- ClickHouse Database Setup for Trading Dashboard
-- Create database if not exists
CREATE DATABASE IF NOT EXISTS trading_db;

-- Use the database
USE trading_db;

-- Market Data Table (Klines/Candlesticks)
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
PARTITION BY toYYYYMM(open_time);

-- Trades Table
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

-- Orders Table
CREATE TABLE IF NOT EXISTS orders (
    order_id String,
    user_id String,
    symbol String,
    side String,
    type String,
    quantity Float64,
    price Float64,
    status String,
    timestamp DateTime64(3),
    filled_quantity Float64 DEFAULT 0,
    average_price Float64 DEFAULT 0,
    created_at DateTime DEFAULT now()
) ENGINE = MergeTree()
ORDER BY (user_id, timestamp)
PARTITION BY toYYYYMM(timestamp);

-- Performance Metrics Table
CREATE TABLE IF NOT EXISTS performance_metrics (
    user_id String,
    date Date,
    period String,
    total_trades UInt32,
    winning_trades UInt32,
    losing_trades UInt32,
    win_rate Float64,
    total_pnl Float64,
    average_pnl Float64,
    max_drawdown Float64,
    sharpe_ratio Float64,
    created_at DateTime DEFAULT now()
) ENGINE = MergeTree()
ORDER BY (user_id, date, period)
PARTITION BY toYYYYMM(date);

-- Volume Data Table
CREATE TABLE IF NOT EXISTS volume_data (
    symbol String,
    period String,
    timestamp DateTime64(3),
    volume Float64,
    trades_count UInt32,
    average_price Float64,
    created_at DateTime DEFAULT now()
) ENGINE = MergeTree()
ORDER BY (symbol, period, timestamp)
PARTITION BY toYYYYMM(timestamp);

-- Show created tables
SHOW TABLES;
