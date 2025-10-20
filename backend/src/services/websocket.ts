import WebSocket from 'ws'
import { Server } from 'http'
import jwt from 'jsonwebtoken'
import { config } from '../config/environment'
import { logger } from '../utils/logger'
import { clickhouseService } from './clickhouseService'

// Track clients by symbol
const clients = new Map<string, Set<WebSocket>>()
// Track Binance connections by symbol
const binanceConnections = new Map<string, WebSocket>()
// Track clients by user ID for user-specific events
const userClients = new Map<number, Set<WebSocket>>()

// Buffer for batch inserting klines to ClickHouse
interface BufferedKline {
  symbol: string
  interval: string
  open_time: string
  close_time: string
  open_price: number
  high_price: number
  low_price: number
  close_price: number
  volume: number
  quote_volume: number
  trades_count: number
  taker_buy_base_volume: number
  taker_buy_quote_volume: number
  created_at: string
}

const klineBuffer: BufferedKline[] = []
let batchInsertInterval: NodeJS.Timeout | null = null

export function setupWebSocketServer(server: Server) {
  const wss = new WebSocket.Server({
    server,
    path: '/ws',
    verifyClient: (info, cb) => {
      const origin = info.origin
      // Allow localhost for development
      if (!origin || origin.includes('localhost') || origin.includes('127.0.0.1')) {
        logger.info(`✅ WebSocket origin allowed: ${origin || 'internal'}`)
        cb(true)
      } else {
        logger.warn(`❌ WebSocket origin rejected: ${origin}`)
        cb(false, 403, 'Forbidden')
      }
    },
  })

  // Start batch insert interval
  startBatchInsertInterval()

  wss.on('connection', (ws: WebSocket, req) => {
    const params = new URLSearchParams(req.url?.split('?')[1])
    const symbol = params.get('symbol') || 'BTCUSDT'
    const token = params.get('token')
    
    // JWT Authentication
    if (!token) {
      logger.warn('❌ WebSocket connection rejected: No token provided')
      ws.close(1008, 'No token provided')
      return
    }
    
    let userId: number
    try {
      const decoded = jwt.verify(token, config.JWT_SECRET) as any
      userId = decoded.userId
      logger.info(`✅ JWT token verified for WebSocket connection (userId: ${userId})`)
    } catch (err: any) {
      logger.warn(`❌ WebSocket connection rejected: Invalid token - ${err.message}`)
      ws.close(1008, 'Invalid token')
      return
    }
    
    logger.info(`🔌 Client connected for ${symbol} (userId: ${userId})`)
    
    // Add client to symbol group
    if (!clients.has(symbol)) {
      clients.set(symbol, new Set())
    }
    clients.get(symbol)!.add(ws)
    
    // Add client to user-specific group
    if (!userClients.has(userId)) {
      userClients.set(userId, new Set())
    }
    userClients.get(userId)!.add(ws)

    // Create Binance connection if doesn't exist
    if (!binanceConnections.has(symbol)) {
      connectToBinance(symbol)
    }

    // Send connection status
    ws.send(JSON.stringify({
      type: 'status',
      connected: true,
      symbol,
      timestamp: Date.now()
    }))

    // Handle client messages (ping/pong for latency tracking)
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString())
        
        if (message.type === 'ping') {
          // Respond with pong
          ws.send(JSON.stringify({
            type: 'pong',
            timestamp: Date.now()
          }))
        }
      } catch (error) {
        logger.error('Error handling WebSocket message', { error })
      }
    })

    // Handle client disconnect
    ws.on('close', () => {
      logger.info(`🔌 Client disconnected for ${symbol} (userId: ${userId})`)
      clients.get(symbol)?.delete(ws)
      userClients.get(userId)?.delete(ws)
      
      // Clean up empty user client sets
      if (userClients.get(userId)?.size === 0) {
        userClients.delete(userId)
      }
      
      // If no more clients for this symbol, close Binance connection
      if (clients.get(symbol)?.size === 0) {
        logger.info(`📡 No more clients for ${symbol}, closing Binance connection`)
        binanceConnections.get(symbol)?.close()
        binanceConnections.delete(symbol)
        clients.delete(symbol)
      }
    })

    ws.on('error', (error) => {
      logger.error(`❌ Client WebSocket error for ${symbol}:`, error)
    })
  })

  logger.info('🚀 WebSocket server setup completed on /ws')
}

function connectToBinance(symbol: string) {
  const binanceUrl = `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@kline_1m`
  logger.info(`📡 Connecting to Binance for ${symbol}`)
  
  const binanceWs = new WebSocket(binanceUrl)
  
  binanceWs.on('open', () => {
    logger.info(`✅ Binance connected for ${symbol}`)
  })

  binanceWs.on('message', (data) => {
    try {
      const parsed = JSON.parse(data.toString())
      
      // Send ALL kline updates (real-time), not just closed ones
      if (parsed.e === 'kline') {
        const klineData = {
          type: 'kline',
          symbol: parsed.s,
          data: {
            openTime: parsed.k.t,
            closeTime: parsed.k.T,
            open: parsed.k.o,
            high: parsed.k.h,
            low: parsed.k.l,
            close: parsed.k.c,
            volume: parsed.k.v,
            quoteVolume: parsed.k.q,
            tradesCount: parsed.k.n,
            takerBuyBaseVolume: parsed.k.V,
            takerBuyQuoteVolume: parsed.k.Q,
            isClosed: parsed.k.x
          },
          timestamp: Date.now()
        }

        // Broadcast to all clients for this symbol
        clients.get(symbol)?.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(klineData))
          }
        })

        // Buffer closed klines for batch insert to ClickHouse
        if (parsed.k.x) {
          bufferKlineForClickHouse(parsed)
        }
      }
      } catch (error) {
      logger.error(`Error parsing Binance message for ${symbol}:`, error)
    }
  })

  binanceWs.on('close', (code, reason) => {
    logger.warn(`📡 Binance disconnected for ${symbol}: ${code} - ${reason}`)
    binanceConnections.delete(symbol)
    
    // Reconnect if still have clients
    if (clients.has(symbol) && clients.get(symbol)!.size > 0) {
      logger.info(`🔄 Reconnecting to Binance for ${symbol}`)
      setTimeout(() => connectToBinance(symbol), 5000) // 5 second delay
    }
  })

  binanceWs.on('error', (error) => {
    logger.error(`❌ Binance WebSocket error for ${symbol}:`, error)
    binanceWs.close()
  })

  binanceConnections.set(symbol, binanceWs)
}

// Buffer a closed kline for batch insert to ClickHouse
function bufferKlineForClickHouse(parsed: any) {
  try {
    const kline: BufferedKline = {
      symbol: parsed.s,
      interval: parsed.k.i,
      open_time: new Date(parsed.k.t).toISOString(), // Will be converted to Unix timestamp in service
      close_time: new Date(parsed.k.T).toISOString(),
      open_price: parseFloat(parsed.k.o),
      high_price: parseFloat(parsed.k.h),
      low_price: parseFloat(parsed.k.l),
      close_price: parseFloat(parsed.k.c),
      volume: parseFloat(parsed.k.v),
      quote_volume: parseFloat(parsed.k.q),
      trades_count: parsed.k.n,
      taker_buy_base_volume: parseFloat(parsed.k.V),
      taker_buy_quote_volume: parseFloat(parsed.k.Q),
      created_at: new Date().toISOString()
    }

    klineBuffer.push(kline)
    logger.debug(`📦 Buffered kline for ${kline.symbol} ${kline.interval} (buffer size: ${klineBuffer.length})`)
  } catch (error) {
    logger.error('❌ Error buffering kline:', error)
  }
}

// Batch insert buffered klines to ClickHouse every 10 seconds
async function flushKlineBuffer() {
  if (klineBuffer.length === 0) {
    return
  }

  const bufferCopy = [...klineBuffer]
  klineBuffer.length = 0 // Clear buffer

  try {
    logger.info(`💾 Flushing ${bufferCopy.length} klines to ClickHouse...`)
    await clickhouseService.batchInsertMarketData(bufferCopy)
    logger.info(`✅ Successfully inserted ${bufferCopy.length} klines to ClickHouse`)
      } catch (error) {
    logger.error('❌ Failed to flush klines to ClickHouse:', error)
    // On error, push back to buffer for retry (but limit to prevent memory issues)
    if (klineBuffer.length < 10000) {
      klineBuffer.push(...bufferCopy)
      logger.warn(`⚠️ Re-buffered ${bufferCopy.length} klines for retry`)
    } else {
      logger.error('❌ Buffer overflow, dropping klines to prevent memory issues')
    }
  }
}

// Start batch insert interval (every 10 seconds)
function startBatchInsertInterval() {
  if (!batchInsertInterval) {
    batchInsertInterval = setInterval(flushKlineBuffer, 10000) // 10 seconds
    logger.info('⏰ Started batch insert interval (every 10 seconds)')
  }
}

// Stop batch insert interval
function stopBatchInsertInterval() {
  if (batchInsertInterval) {
    clearInterval(batchInsertInterval)
    batchInsertInterval = null
    logger.info('⏰ Stopped batch insert interval')
  }
}

// Broadcast trade event to specific user
export function broadcastTradeEvent(userId: number, tradeData: any) {
  const userConnections = userClients.get(userId)
  
  if (!userConnections || userConnections.size === 0) {
    logger.debug(`No active WebSocket connections for user ${userId}`)
    return
  }
  
  const message = JSON.stringify({
    type: 'trade',
    data: tradeData,
    timestamp: Date.now()
  })
  
  let sentCount = 0
  userConnections.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message)
      sentCount++
    }
  })
  
  logger.info(`📢 Broadcast trade event to ${sentCount} connection(s) for user ${userId}`)
}

// Graceful shutdown
export function closeWebSocketServer() {
  logger.info('🔌 Closing all WebSocket connections...')
  
  // Stop batch insert interval
  stopBatchInsertInterval()
  
  // Flush remaining buffer before shutdown
  if (klineBuffer.length > 0) {
    logger.info(`💾 Flushing remaining ${klineBuffer.length} klines before shutdown...`)
    flushKlineBuffer()
  }
  
  // Close all Binance connections
  binanceConnections.forEach((ws, symbol) => {
    logger.info(`📡 Closing Binance connection for ${symbol}`)
    ws.close(1000, 'Server shutdown')
  })
  
  // Close all client connections
  clients.forEach((clientSet) => {
    clientSet.forEach((client) => {
      client.close(1000, 'Server shutdown')
    })
  })
  
  clients.clear()
  binanceConnections.clear()
  userClients.clear()
}

