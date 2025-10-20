'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, Activity } from 'lucide-react'
import { useWebSocket } from '@/hooks/useWebSocket'

interface MarketData {
  symbol: string
  price: string
  change: string
  changePercent: string
  volume: string
  high: string
  low: string
}

export default function MarketDataOverview() {
  const [marketData, setMarketData] = useState<MarketData[]>([])
  const [loading, setLoading] = useState(true)

  // WebSocket for real-time updates (BTCUSDT)
  useWebSocket({
    symbol: 'BTCUSDT',
    enabled: !loading,
    onMessage: (message) => {
      if (message.type === 'kline' && message.data) {
        updateSymbolPrice('BTCUSDT', message.data)
      }
    }
  })

  // WebSocket for ETHUSDT
  useWebSocket({
    symbol: 'ETHUSDT',
    enabled: !loading,
    onMessage: (message) => {
      if (message.type === 'kline' && message.data) {
        updateSymbolPrice('ETHUSDT', message.data)
      }
    }
  })

  // WebSocket for BNBUSDT
  useWebSocket({
    symbol: 'BNBUSDT',
    enabled: !loading,
    onMessage: (message) => {
      if (message.type === 'kline' && message.data) {
        updateSymbolPrice('BNBUSDT', message.data)
      }
    }
  })

  // Helper function to update symbol price
  const updateSymbolPrice = (symbol: string, data: any) => {
    setMarketData(prev => prev.map(item => {
      if (item.symbol === symbol) {
        return {
          ...item,
          price: data.close,
          high: data.high,
          low: data.low
        }
      }
      return item
    }))
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

  const formatChange = (change: string): string => {
    const num = parseFloat(change)
    return num.toFixed(2)
  }

  const formatVolume = (volume: string): string => {
    const num = parseFloat(volume)
    if (num >= 1000000000) {
      return (num / 1000000000).toFixed(2) + 'B'
    } else if (num >= 1000000) {
      return (num / 1000000).toFixed(2) + 'M'
    } else if (num >= 1000) {
      return (num / 1000).toFixed(2) + 'K'
    } else {
      return num.toFixed(0)
    }
  }

  const formatHighLow = (value: string): string => {
    const num = parseFloat(value)
    if (num >= 1000) {
      return num.toFixed(2)
    } else if (num >= 1) {
      return num.toFixed(4)
    } else {
      return num.toFixed(6)
    }
  }

  useEffect(() => {
    // Simulate API call
    const fetchMarketData = async () => {
      try {
        const response = await fetch('http://localhost:3002/api/v1/market-data/symbols')
        const data = await response.json()
        
        if (data.success) {
          // Use real API data from Binance
          const realData: MarketData[] = data.data.symbols.map((symbol: any) => ({
            symbol: symbol.symbol,
            price: symbol.price || '0.00',
            change: symbol.change || '0.00',
            changePercent: symbol.changePercent || '0.00',
            volume: symbol.volume || '0',
            high: symbol.high || '0.00',
            low: symbol.low || '0.00',
          }))
          setMarketData(realData)
        }
      } catch (error) {
        console.error('Failed to fetch market data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchMarketData()
    
    // Update data every 5 seconds
    const interval = setInterval(fetchMarketData, 5000)
    
    return () => {
      clearInterval(interval)
    }
  }, [])

  if (loading) {
    return (
      <div className="glass rounded-2xl shadow-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6">
        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Market Data</h2>
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-[var(--background)] rounded"></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="glass rounded-2xl shadow-lg border border-[var(--card-border)] bg-[var(--card-bg)] overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--card-border)]">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Market Data</h2>
      </div>
      
      {/* Desktop/Tablet Table View */}
      <div className="hidden sm:block w-full overflow-x-auto">
        <table className="w-full divide-y divide-[var(--card-border)]">
          <thead className="bg-[var(--background)]">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider">
                Symbol
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider">
                Price
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider">
                Change
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider hidden sm:table-cell">
                Volume
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider hidden md:table-cell">
                High/Low
              </th>
            </tr>
          </thead>
          <tbody className="bg-[var(--card-bg)] divide-y divide-[var(--card-border)]">
            {marketData.map((data) => {
              const isPositive = parseFloat(data.change) >= 0
              return (
                <tr key={data.symbol} className="hover:bg-[var(--background)] transition-colors">
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="flex items-center">
                      <Activity className="h-3 w-3 text-[var(--muted)] mr-2" />
                      <span className="text-xs sm:text-sm font-medium text-[var(--foreground)]">{data.symbol}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="text-xs sm:text-sm text-[var(--foreground)] font-mono">${formatPrice(data.price)}</span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="flex items-center">
                      {isPositive ? (
                        <TrendingUp className="h-3 w-3 text-[#2EBD85] mr-1" />
                      ) : (
                        <TrendingDown className="h-3 w-3 text-[#F6465D] mr-1" />
                      )}
                      <div className="flex flex-col sm:flex-row sm:items-center">
                        <span className={`text-xs sm:text-sm font-mono ${isPositive ? 'text-[#2EBD85]' : 'text-[#F6465D]'}`}>
                          {formatChange(data.change)}
                        </span>
                        <span className={`text-xs font-mono ${isPositive ? 'text-[#2EBD85]' : 'text-[#F6465D]'} sm:ml-1`}>
                          ({data.changePercent}%)
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs sm:text-sm text-[var(--foreground)] font-mono hidden sm:table-cell">
                    {formatVolume(data.volume)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs hidden md:table-cell">
                    <div className="space-y-0.5">
                      <div className="text-[#2EBD85] font-mono">H: ${formatHighLow(data.high)}</div>
                      <div className="text-[#F6465D] font-mono">L: ${formatHighLow(data.low)}</div>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="sm:hidden space-y-3 p-4">
        {marketData.map((data) => {
          const isPositive = parseFloat(data.change) >= 0
          return (
            <div key={data.symbol} className="bg-[var(--background)] rounded-lg p-3 border border-[var(--card-border)]">
              {/* Header - Symbol and Price */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  <Activity className="h-4 w-4 text-[var(--muted)] mr-2" />
                  <span className="text-sm font-medium text-[var(--foreground)]">{data.symbol}</span>
                </div>
                <span className="text-lg font-mono font-semibold text-[var(--foreground)]">
                  ${formatPrice(data.price)}
                </span>
              </div>

              {/* Change */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-[var(--muted)]">24h Change</span>
                <div className="flex items-center">
                  {isPositive ? (
                    <TrendingUp className="h-3 w-3 text-[#2EBD85] mr-1" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-[#F6465D] mr-1" />
                  )}
                  <span className={`text-sm font-mono ${isPositive ? 'text-[#2EBD85]' : 'text-[#F6465D]'}`}>
                    {formatChange(data.change)} ({data.changePercent}%)
                  </span>
                </div>
              </div>

              {/* Volume and High/Low */}
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="text-center">
                  <div className="text-[var(--muted)]">Volume</div>
                  <div className="text-[var(--foreground)] font-mono">{formatVolume(data.volume)}</div>
                </div>
                <div className="text-center">
                  <div className="text-[var(--muted)]">High</div>
                  <div className="text-[#2EBD85] font-mono">${formatHighLow(data.high)}</div>
                </div>
                <div className="text-center">
                  <div className="text-[var(--muted)]">Low</div>
                  <div className="text-[#F6465D] font-mono">${formatHighLow(data.low)}</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}