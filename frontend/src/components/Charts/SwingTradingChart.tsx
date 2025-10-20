'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Chart as ChartJS, registerables } from 'chart.js'
import { Chart } from 'react-chartjs-2'
import { CandlestickController, CandlestickElement } from 'chartjs-chart-financial'
import zoomPlugin from 'chartjs-plugin-zoom'
import 'chartjs-adapter-date-fns'
import { TrendingUp, TrendingDown, Activity, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'
import { useWebSocket } from '@/hooks/useWebSocket'

ChartJS.register(...registerables, CandlestickController, CandlestickElement, zoomPlugin)

interface Kline {
  openTime: number
  open: string
  high: string
  low: string
  close: string
  volume: string
  closeTime: number
  quoteVolume: string
  tradesCount: number
  takerBuyBaseVolume: string
  takerBuyQuoteVolume: string
}

interface SwingTradingChartProps {
  symbol?: string
}

interface ChartData {
  symbol: string
  interval: string
  period: string
  klines: Kline[]
  total: number
  strategy: string
  description: string
}

export default function SwingTradingChart({ symbol: propSymbol }: SwingTradingChartProps) {
  const [selectedSymbol, setSelectedSymbol] = useState('BTCUSDT')
  const [chartData, setChartData] = useState<ChartData | null>(null)
  
  const symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT']
  
  // Load from localStorage on mount (GLOBAL SYMBOL)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('globalTradingSymbol')
      if (saved && symbols.includes(saved)) {
        setSelectedSymbol(saved)
      }
    }
  }, [])
  
  // Save to localStorage when symbol changes (GLOBAL SYMBOL)
  const handleSymbolChange = (newSymbol: string) => {
    // Store scroll position before change
    const scrollY = window.scrollY
    
    setSelectedSymbol(newSymbol)
    if (typeof window !== 'undefined') {
      localStorage.setItem('globalTradingSymbol', newSymbol)
    }
    
    // Restore scroll position after state update
    requestAnimationFrame(() => {
      window.scrollTo(0, scrollY)
    })
  }
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [priceChange, setPriceChange] = useState(0)
  const [currentPrice, setCurrentPrice] = useState(0)
  const chartRef = useRef<ChartJS>(null)

  // WebSocket for real-time updates
  const { isConnected } = useWebSocket({
    symbol: selectedSymbol,
    enabled: !loading,
    onMessage: (message) => {
      if (message.type === 'kline' && chartData) {
        const kline = message.data
        const newPrice = parseFloat(kline.close)
        setCurrentPrice(newPrice)
        
        if (chartData.klines.length > 0) {
          const firstPrice = parseFloat(chartData.klines[0].open)
          const change = ((newPrice - firstPrice) / firstPrice) * 100
          setPriceChange(change)
        }
      }
    }
  })

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const response = await fetch(`http://localhost:3002/api/v1/charts/swing-trading/${selectedSymbol}`)
        const result = await response.json()
        
        if (result.success) {
          setChartData(result.data)
          
          // Calculate price change
          const klines = result.data.klines
          if (klines.length > 1) {
            const firstPrice = parseFloat(klines[0].close)
            const lastPrice = parseFloat(klines[klines.length - 1].close)
            setCurrentPrice(lastPrice)
            setPriceChange(((lastPrice - firstPrice) / firstPrice) * 100)
          }
        } else {
          setError(result.message || 'Failed to fetch data')
        }
      } catch (err) {
        setError('Network error occurred')
        console.error('Swing trading chart error:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [selectedSymbol])

  const formatPrice = (value: number) => {
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="glass rounded-2xl shadow-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-[var(--background)] rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-[var(--background)] rounded"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="glass rounded-2xl shadow-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-6">
        <div className="text-center">
          <div className="text-red-500 mb-2">⚠️</div>
          <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">Error Loading Chart</h3>
          <p className="text-[var(--muted)]">{error}</p>
        </div>
      </div>
    )
  }

  if (!chartData) {
    return null
  }

  // Prepare data for Chart.js financial
  const financialData = chartData.klines.map(kline => ({
    x: kline.openTime,
    o: parseFloat(kline.open),
    h: parseFloat(kline.high),
    l: parseFloat(kline.low),
    c: parseFloat(kline.close)
  }))

  const chartConfig = {
    type: 'candlestick' as const,
    data: {
      datasets: [{
        label: 'Price',
        data: financialData,
        color: {
          up: '#2EBD85',
          down: '#F6465D',
          unchanged: '#AEBCC2'
        }
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          mode: 'index' as const,
          intersect: false,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: '#ffffff',
          bodyColor: '#ffffff',
          borderColor: '#AEBCC2',
          borderWidth: 1,
          callbacks: {
            title: function(context: any) {
              return formatTime(context[0].parsed.x)
            },
            label: function(context: any) {
              const data = context.parsed
              return [
                `Open: ${formatPrice(data.o)}`,
                `High: ${formatPrice(data.h)}`,
                `Low: ${formatPrice(data.l)}`,
                `Close: ${formatPrice(data.c)}`
              ]
            }
          }
        },
        zoom: {
          pan: {
            enabled: true,
            mode: 'x' as const,
            modifierKey: null as any
          },
          zoom: {
            wheel: {
              enabled: true,
              speed: 0.1,
              modifierKey: 'ctrl' as any  // Require Ctrl key for wheel zoom
            },
            pinch: {
              enabled: true
            },
            mode: 'x' as const
          },
          limits: {
            x: {
              min: 'original' as const,
              max: 'original' as const
            }
          }
        }
      },
      scales: {
        x: {
          display: true,
          type: 'time' as const,
          time: {
            unit: 'hour' as const,
            displayFormats: {
              hour: 'MMM dd HH:mm'
            },
            tooltipFormat: 'MMM dd HH:mm'
          },
          grid: {
            display: true,
            color: 'rgba(174, 188, 194, 0.1)'
          },
          ticks: {
            color: '#AEBCC2',
            maxTicksLimit: 8,
            callback: function(value: any) {
              const date = new Date(value)
              return date.toLocaleDateString('tr-TR', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                hour12: false
              })
            }
          }
        },
        y: {
          display: true,
          grid: {
            display: true,
            color: 'rgba(174, 188, 194, 0.1)'
          },
          ticks: {
            color: '#AEBCC2',
            callback: function(value: any) {
              return formatPrice(value)
            }
          }
        }
      },
      interaction: {
        mode: 'nearest' as const,
        axis: 'x' as const,
        intersect: false
      }
    }
  }

  return (
    <div className="glass rounded-2xl shadow-lg border border-[var(--card-border)] bg-[var(--card-bg)]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--card-border)]">
        <div className="flex items-center justify-between flex-wrap gap-4">
          {/* Left: Title & Info */}
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h3 className="text-lg font-semibold text-[var(--foreground)]">{chartData.strategy}</h3>
              <div className="flex items-center gap-2">
                {isConnected ? (
                  <>
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-green-500 text-xs">LIVE</span>
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                    <span className="text-gray-500 text-xs">CONNECTING...</span>
                  </>
                )}
              </div>
            </div>
            <p className="text-xs text-[var(--muted)]">Hourly candles for medium-term positions, last 1 week</p>
            {currentPrice > 0 && (
              <div className="flex items-center gap-4 mt-2">
                <p className="text-sm font-mono text-[var(--foreground)]">
                  Current: {formatPrice(currentPrice)}
                </p>
                <div className="flex items-center">
                  {priceChange >= 0 ? (
                    <>
                      <TrendingUp className="w-4 h-4 text-[#2EBD85] mr-1" />
                      <span className="text-sm font-bold text-[#2EBD85]">+{priceChange.toFixed(2)}%</span>
                    </>
                  ) : (
                    <>
                      <TrendingDown className="w-4 h-4 text-[#F6465D] mr-1" />
                      <span className="text-sm font-bold text-[#F6465D]">{priceChange.toFixed(2)}%</span>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right: Symbol Selector & Zoom Controls */}
          <div className="flex items-center gap-4">
            {/* Symbol Selector */}
            <select
              value={selectedSymbol}
              onChange={(e) => handleSymbolChange(e.target.value)}
              className="px-3 py-1.5 bg-[var(--background)] border border-[var(--card-border)] rounded-lg 
                       focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all
                       text-[var(--foreground)] font-semibold text-sm"
            >
              {symbols.map(sym => (
                <option key={sym} value={sym}>{sym}</option>
              ))}
            </select>

            {/* Zoom Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => chartRef.current?.zoom(1.1)}
                className="p-1.5 rounded-lg bg-[var(--background)] hover:bg-[var(--card-border)] 
                         transition-colors border border-[var(--card-border)]"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4 text-[var(--foreground)]" />
              </button>
              <button
                onClick={() => chartRef.current?.zoom(0.9)}
                className="p-1.5 rounded-lg bg-[var(--background)] hover:bg-[var(--card-border)] 
                         transition-colors border border-[var(--card-border)]"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4 text-[var(--foreground)]" />
              </button>
              <button
                onClick={() => chartRef.current?.resetZoom()}
                className="p-1.5 rounded-lg bg-[var(--background)] hover:bg-[var(--card-border)] 
                         transition-colors border border-[var(--card-border)]"
                title="Reset"
              >
                <Maximize2 className="w-4 h-4 text-[var(--foreground)]" />
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Chart */}
      <div className="p-4">
        <div style={{ height: '400px', position: 'relative' }}>
          <Chart ref={chartRef} {...chartConfig} />
        </div>
        <div className="mt-2 text-xs text-[var(--muted)] text-center">
          💡 Use mouse wheel to zoom, drag to pan
        </div>
      </div>
    </div>
  )
}
