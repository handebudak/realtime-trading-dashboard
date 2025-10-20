import { useEffect, useRef, useState } from 'react'

interface UseWebSocketProps {
  symbol: string
  onMessage: (data: any) => void
  enabled?: boolean
}

interface WebSocketMessage {
  type: string
  symbol: string
  data: any
  timestamp: number
}

export function useWebSocket({ symbol, onMessage, enabled = true }: UseWebSocketProps) {
  const [isConnected, setIsConnected] = useState(false)
  const [latency, setLatency] = useState<number | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const pingTimestampRef = useRef<number | null>(null)
  const retryCountRef = useRef(0)
  const maxRetries = 10
  const baseDelay = 1000 // ms
  const pingInterval = 10000 // 10 seconds

  const startPingInterval = () => {
    // Clear existing interval
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current)
    }

    // Send ping every N seconds
    pingIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        pingTimestampRef.current = Date.now()
        wsRef.current.send(JSON.stringify({ type: 'ping', timestamp: pingTimestampRef.current }))
      }
    }, pingInterval)
  }

  const stopPingInterval = () => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current)
      pingIntervalRef.current = null
    }
    pingTimestampRef.current = null
  }

  const connect = () => {
    // Don't connect if disabled or already connected
    if (!enabled || wsRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    // Clear any existing connection
    if (wsRef.current) {
      wsRef.current.close()
    }

    // Get JWT token from localStorage (AuthContext format)
    const authTokens = localStorage.getItem('auth_tokens')
    if (!authTokens) {
      console.warn('⚠️ No auth tokens found, skipping WebSocket connection')
      return
    }
    
    const parsedTokens = JSON.parse(authTokens)
    const token = parsedTokens.accessToken
    if (!token) {
      console.warn('⚠️ No access token found in auth_tokens, skipping WebSocket connection')
      return
    }
    
    const url = `ws://localhost:3002/ws?symbol=${symbol}&token=${token}`
    console.log(`🔌 Connecting to WebSocket: ${url}`)
    
    try {
      wsRef.current = new WebSocket(url)

      wsRef.current.onopen = () => {
        setIsConnected(true)
        retryCountRef.current = 0
        console.log(`✅ WebSocket connected for ${symbol}`)
        
        // Start ping interval for latency monitoring
        startPingInterval()
      }

      wsRef.current.onmessage = (event) => {
        try {
          const data: WebSocketMessage = JSON.parse(event.data)
          
          if (data.type === 'kline') {
            console.log(`📊 Received kline for ${symbol}`)
            onMessage(data)
          } else if (data.type === 'trade') {
            console.log(`💰 Received trade event:`, data)
            onMessage(data)
          } else if (data.type === 'status') {
            console.log(`📡 WebSocket status for ${symbol}:`, data)
          } else if (data.type === 'pong') {
            // Calculate latency from ping timestamp
            if (pingTimestampRef.current) {
              const roundTripTime = Date.now() - pingTimestampRef.current
              setLatency(roundTripTime)
              console.log(`⏱️ WebSocket latency: ${roundTripTime}ms`)
              pingTimestampRef.current = null
            }
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error)
        }
      }

      wsRef.current.onclose = (event) => {
        setIsConnected(false)
        stopPingInterval()
        setLatency(null)
        console.log(`🔌 WebSocket closed for ${symbol}: code ${event.code}`)
        
        // Attempt reconnection with exponential backoff
        if (enabled && retryCountRef.current < maxRetries) {
          const delay = baseDelay * Math.pow(2, retryCountRef.current) + Math.random() * 1000
          console.log(`🔄 Reconnecting in ${Math.round(delay)}ms... (attempt ${retryCountRef.current + 1}/${maxRetries})`)
          
          reconnectTimeoutRef.current = setTimeout(() => {
            retryCountRef.current++
            connect()
          }, delay)
        } else if (retryCountRef.current >= maxRetries) {
          console.warn(`❌ Max retries reached for ${symbol}, giving up`)
        }
      }

      wsRef.current.onerror = (error) => {
        console.error(`❌ WebSocket error for ${symbol}:`, error)
        wsRef.current?.close()
      }
    } catch (error) {
      console.error('Error creating WebSocket:', error)
    }
  }

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    
    stopPingInterval()
    
    if (wsRef.current) {
      // Remove event listeners before closing
      wsRef.current.onopen = null
      wsRef.current.onmessage = null
      wsRef.current.onclose = null
      wsRef.current.onerror = null
      
      wsRef.current.close(1000, 'Symbol changed or component unmounting')
      wsRef.current = null
    }
    
    setIsConnected(false)
    setLatency(null)
    retryCountRef.current = 0
  }

  useEffect(() => {
    // Disconnect old connection first
    disconnect()
    
    // Then connect with new symbol
    if (symbol && enabled) {
      // Small delay to ensure clean disconnect
      const connectTimer = setTimeout(() => {
        connect()
      }, 100)
      
      return () => {
        clearTimeout(connectTimer)
        disconnect()
      }
    }

    return () => {
      disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, enabled])

  return { isConnected, latency }
}

