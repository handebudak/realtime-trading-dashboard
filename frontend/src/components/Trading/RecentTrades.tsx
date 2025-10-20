'use client'

import { useState, useEffect, useCallback } from 'react'
import { ArrowUp, ArrowDown, Clock } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useWebSocket } from '@/hooks/useWebSocket'

interface Trade {
  id: string
  symbol: string
  side: 'BUY' | 'SELL'
  quantity: string
  price: string
  timestamp: string
}

export default function RecentTrades() {
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const { tokens } = useAuth()

  // Fetch initial trades
  useEffect(() => {
    const fetchTrades = async () => {
      if (!tokens?.accessToken) {
        console.log('No access token available for trades')
        setLoading(false)
        return
      }

      try {
        const response = await fetch('http://localhost:3002/api/v1/trading/trades', {
          headers: {
            'Authorization': `Bearer ${tokens.accessToken}`,
            'Content-Type': 'application/json',
          },
        })
        const data = await response.json()
        
        if (data.success) {
          setTrades(data.data.trades || [])
        }
      } catch (error) {
        console.error('Failed to fetch trades:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchTrades()
  }, [tokens?.accessToken])

  // Handle WebSocket trade events
  const handleWebSocketMessage = useCallback((message: any) => {
    if (message.type === 'trade') {
      console.log('📢 New trade received via WebSocket:', message.data)
      
      // Add new trade to the beginning of the list
      setTrades((prevTrades) => {
        const newTrade: Trade = {
          id: message.data.id.toString(),
          symbol: message.data.symbol,
          side: message.data.side,
          quantity: message.data.quantity.toString(),
          price: message.data.price.toString(),
          timestamp: message.data.timestamp
        }
        
        // Add to beginning and limit to 50 trades
        return [newTrade, ...prevTrades].slice(0, 50)
      })
    }
  }, [])

  // Connect to WebSocket (using BTCUSDT as default symbol, but we're listening to user-specific trade events)
  useWebSocket({
    symbol: 'BTCUSDT',
    onMessage: handleWebSocketMessage,
    enabled: !!tokens?.accessToken
  })

  const formatTime = (timestamp: string) => {
    // Handle "Invalid Date" by checking if timestamp is valid
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      return "Invalid Date";
    }
    return date.toLocaleTimeString();
  }

  // Format numbers like Binance
  const formatPrice = (price: string): string => {
    const num = parseFloat(price)
    if (num >= 1000) {
      return num.toFixed(2)
    } else if (num >= 1) {
      return num.toFixed(4)
    } else {
      return num.toFixed(6)
    }
  }

  const formatQuantity = (quantity: string): string => {
    const num = parseFloat(quantity)
    if (num >= 1000) {
      return num.toFixed(2)
    } else if (num >= 1) {
      return num.toFixed(4)
    } else {
      return num.toFixed(6)
    }
  }

  if (loading) {
    return (
      <div className="glass rounded-2xl shadow-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6">
        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Recent Trades</h2>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 bg-[var(--background)] rounded"></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="glass rounded-2xl shadow-2xl border border-[var(--card-border)] bg-[var(--card-bg)]">
      <div className="px-6 py-4 border-b border-[var(--card-border)]">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Recent Trades</h2>
      </div>
      
      {/* Match System Metrics height exactly - System Metrics now has 3 items + header + padding */}
      <div className="h-64 overflow-y-auto">
        {trades.length === 0 ? (
          <div className="p-6 text-center text-[var(--muted)] flex items-center justify-center h-full">
            <div>
              <Clock className="h-12 w-12 mx-auto mb-4 text-[var(--muted-light)]" />
              <p>No recent trades</p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-[var(--card-border)]">
            {trades.map((trade) => (
              <div key={trade.id} className="p-3 hover:bg-[var(--background)] transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {trade.side === 'BUY' ? (
                      <ArrowUp className="h-4 w-4 text-[#2EBD85]" />
                    ) : (
                      <ArrowDown className="h-4 w-4 text-[#F6465D]" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-[var(--foreground)]">
                        {trade.symbol}
                      </p>
                      <p className="text-xs text-[var(--muted)]">
                        {formatTime(trade.timestamp)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <p className={`text-sm font-medium font-mono ${
                      trade.side === 'BUY' ? 'text-[#2EBD85]' : 'text-[#F6465D]'
                    }`}>
                      {trade.side === 'BUY' ? '+' : '-'}{formatQuantity(trade.quantity)}
                    </p>
                    <p className="text-xs text-[var(--muted)] font-mono">
                      @ ${formatPrice(trade.price)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}