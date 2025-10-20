'use client'

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Chart as ChartJS, registerables } from 'chart.js'
import { Chart } from 'react-chartjs-2'
import zoomPlugin from 'chartjs-plugin-zoom'
import annotationPlugin from 'chartjs-plugin-annotation'
import 'chartjs-adapter-date-fns'
import { Activity, TrendingUp, TrendingDown, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'
import { useWebSocket } from '@/hooks/useWebSocket'
import { api } from '@/services/apiClient'

ChartJS.register(...registerables, zoomPlugin, annotationPlugin)

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

interface RSIChartProps {
  symbol?: string
}

interface ChartData {
  symbol: string
  interval: string
  period: string
  klines: Kline[]
  total: number
}

export default function RSIChart({ symbol: propSymbol }: RSIChartProps) {
  const [selectedSymbol, setSelectedSymbol] = useState('BTCUSDT')
  const [selectedTimeframe, setSelectedTimeframe] = useState('15m') // Main chart timeframe
  const [rsiPeriod, setRsiPeriod] = useState(14) // RSI calculation period (number of candles)
  const [chartData, setChartData] = useState<ChartData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentRSI, setCurrentRSI] = useState(0)
  const [rsiStatus, setRsiStatus] = useState<'overbought' | 'oversold' | 'neutral'>('neutral')
  const chartRef = useRef<ChartJS>(null)
  const chartDataRef = useRef<ChartData | null>(null)

  const symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT']
  const timeframes = ['1m', '5m', '15m', '1h', '4h', '1d']
  const rsiPeriods = [7, 9, 14, 21, 28] // Standard RSI periods used in real trading
  
  // Calculate how many candles to fetch based on RSI period (need extra for calculation)
  const getCandleLimit = (rsiPeriod: number): number => {
    // Fetch RSI period + 50% buffer for accurate calculation + display
    return Math.min(Math.ceil(rsiPeriod * 3), 500)
  }

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
  const handleSymbolChange = useCallback((newSymbol: string) => {
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
  }, [])

  // Handle timeframe change
  const handleTimeframeChange = useCallback((newTimeframe: string) => {
    setSelectedTimeframe(newTimeframe)
  }, [])

  // Calculate RSI
  const calculateRSI = (klines: Kline[], period: number = 14): number[] => {
    if (klines.length < period + 1) {
      return []
    }

    const rsiValues: number[] = []
    const prices = klines.map(k => parseFloat(k.close))

    // Calculate price changes
    const changes: number[] = []
    for (let i = 1; i < prices.length; i++) {
      changes.push(prices[i] - prices[i - 1])
    }

    // Calculate initial average gain and loss
    let avgGain = 0
    let avgLoss = 0

    for (let i = 0; i < period; i++) {
      if (changes[i] > 0) {
        avgGain += changes[i]
      } else {
        avgLoss += Math.abs(changes[i])
      }
    }

    avgGain /= period
    avgLoss /= period

    // First RSI value
    const rs1 = avgGain / avgLoss
    rsiValues.push(100 - (100 / (1 + rs1)))

    // Calculate subsequent RSI values
    for (let i = period; i < changes.length; i++) {
      const change = changes[i]
      
      if (change > 0) {
        avgGain = (avgGain * (period - 1) + change) / period
        avgLoss = (avgLoss * (period - 1)) / period
      } else {
        avgGain = (avgGain * (period - 1)) / period
        avgLoss = (avgLoss * (period - 1) + Math.abs(change)) / period
      }

      const rs = avgGain / avgLoss
      rsiValues.push(100 - (100 / (1 + rs)))
    }

    return rsiValues
  }

  // Real-time chart update function - using imperative API to avoid re-render
  // CRITICAL FIX: No dependencies! Uses refs to avoid stale closures
  const updateChartWithRealTimeData = useCallback((newKline: any) => {
    const currentChartData = chartDataRef.current
    if (!currentChartData || !chartRef.current) return

    // Only add new closed candle
    if (newKline.isClosed) {
      const chart = chartRef.current
      const lastLabel = chart.data.labels?.[chart.data.labels.length - 1]
      
      // Normalize both to milliseconds for comparison
      const normalizedNewTime = newKline.openTime < 1e12 ? newKline.openTime * 1000 : newKline.openTime
      const normalizedLastLabel = typeof lastLabel === 'number' ? (lastLabel < 1e12 ? lastLabel * 1000 : lastLabel) : 0
      
      // Avoid duplicates
      if (normalizedLastLabel === normalizedNewTime) {
        return
      }
      
      // Update internal klines array for RSI calculation
      const updatedKlines = [...currentChartData.klines, {
        openTime: newKline.openTime,
        open: newKline.open,
        high: newKline.high,
        low: newKline.low,
        close: newKline.close,
        volume: newKline.volume,
        closeTime: newKline.closeTime,
        quoteVolume: newKline.quoteVolume,
        tradesCount: newKline.tradesCount,
        takerBuyBaseVolume: newKline.takerBuyBaseVolume,
        takerBuyQuoteVolume: newKline.takerBuyQuoteVolume
      }]
      
      // Keep reasonable number of candles (RSI period * 3)
      const maxCandles = getCandleLimit(rsiPeriod)
      if (updatedKlines.length > maxCandles) {
        updatedKlines.shift()
      }
      
      // Recalculate RSI (use current RSI period from state - will be latest)
      const rsiValues = calculateRSI(updatedKlines, rsiPeriod)
      const latestRSI = rsiValues[rsiValues.length - 1]
      
      if (latestRSI !== undefined) {
        // Add new data point directly to chart (imperative)
        // Normalize to milliseconds before adding
        const normalizedOpenTime = newKline.openTime < 1e12 ? newKline.openTime * 1000 : newKline.openTime
        chart.data.labels?.push(normalizedOpenTime)
        chart.data.datasets[0]?.data.push(latestRSI)
        
        // Keep appropriate number of data points
        if (chart.data.labels && chart.data.labels.length > maxCandles) {
          chart.data.labels.shift()
          chart.data.datasets.forEach(dataset => dataset.data.shift())
        }
      }
      
      // Update chart without animation (preserves zoom)
      chart.update('none')
      
      // Update RSI status
      setCurrentRSI(latestRSI)
      if (latestRSI >= 70) {
        setRsiStatus('overbought')
      } else if (latestRSI <= 30) {
        setRsiStatus('oversold')
      } else {
        setRsiStatus('neutral')
      }
      
      // Update chartData state properly (CRITICAL FIX!)
      const newChartData = { ...currentChartData, klines: updatedKlines }
      chartDataRef.current = newChartData
      setChartData(newChartData)
    }
  }, [rsiPeriod]) // Only rsiPeriod as dependency

  // WebSocket for real-time updates (only closed candles to reduce updates)
  const handleWebSocketMessage = useCallback((message: any) => {
    if (message.type === 'kline' && chartDataRef.current && message.data.isClosed) {
      // Only update on closed candles to reduce re-renders
      updateChartWithRealTimeData(message.data)
    }
  }, [updateChartWithRealTimeData])

  const { isConnected } = useWebSocket({
    symbol: selectedSymbol,
    enabled: !loading,
    onMessage: handleWebSocketMessage
  })

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)

        // Fetch candles based on RSI period (RSI period * 3 for buffer)
        const limit = getCandleLimit(rsiPeriod)
        
        // Calculate time range for fetching recent data
        const now = Date.now()
        const getIntervalMs = (interval: string): number => {
          const unit = interval.slice(-1)
          const value = parseInt(interval.slice(0, -1)) || 1
          const multipliers: Record<string, number> = {
            'm': 60 * 1000,
            'h': 60 * 60 * 1000,
            'd': 24 * 60 * 60 * 1000
          }
          return value * (multipliers[unit] || 60 * 1000)
        }
        
        const intervalMs = getIntervalMs(selectedTimeframe)
        const startTime = now - (intervalMs * limit)
        
        // Fetch klines directly from Binance via our backend
        const result = await api.get<any>('/api/v1/market-data/klines', { params: { symbol: selectedSymbol, interval: selectedTimeframe, limit } })

        if (result.success && result.data.klines && result.data.klines.length > 0) {
          // CRITICAL FIX: Ensure all timestamps are in milliseconds (13 digits)
          const normalizedKlines = result.data.klines.map((k: Kline) => ({
            ...k,
            openTime: k.openTime < 1e12 ? k.openTime * 1000 : k.openTime,
            closeTime: k.closeTime < 1e12 ? k.closeTime * 1000 : k.closeTime
          }))
          
          // CRITICAL: Always set fresh data when parameters change!
          const newData = {
            symbol: selectedSymbol,
            interval: selectedTimeframe,
            period: `${rsiPeriod} candles`, // For display only
            klines: normalizedKlines,
            total: normalizedKlines.length
          }
          
          // Update both state and ref
          chartDataRef.current = newData
          setChartData(newData)

          // Calculate initial RSI
          const rsiValues = calculateRSI(result.data.klines, rsiPeriod)
          if (rsiValues.length > 0) {
            const latestRSI = rsiValues[rsiValues.length - 1]
            setCurrentRSI(latestRSI)
            
            if (latestRSI >= 70) {
              setRsiStatus('overbought')
            } else if (latestRSI <= 30) {
              setRsiStatus('oversold')
            } else {
              setRsiStatus('neutral')
            }
          }
        } else {
          setError(result.message || 'Failed to fetch data')
        }
      } catch (err) {
        setError('Network error occurred')
        console.error('RSI chart error:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [selectedSymbol, selectedTimeframe, rsiPeriod])

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Memoize expensive RSI calculation (must be before early returns)
  // Chart config RE-CREATED when chartData changes (CRITICAL FIX!)
  const chartConfig = useMemo(() => {
    if (!chartData) return null
    
    // Initial RSI calculation
    const rsiValues = calculateRSI(chartData.klines, rsiPeriod)
    const paddedRSI: (number | null)[] = []
    for (let i = 0; i < chartData.klines.length - rsiValues.length; i++) {
      paddedRSI.push(null)
    }
    paddedRSI.push(...rsiValues)
    
    return {
    type: 'line' as const,
    data: {
      labels: chartData.klines.map(k => k.openTime),
      datasets: [
        {
          label: `RSI (${rsiPeriod})`,
          data: paddedRSI,
          borderColor: '#3B82F6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.1,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false as const,
      plugins: {
        legend: {
          display: true,
          position: 'top' as const,
          labels: {
            color: '#AEBCC2'
          }
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
              const value = context.parsed.y
              if (value === null) return ''
              return `RSI: ${value.toFixed(2)}`
            }
          }
        },
        annotation: {
          annotations: {
            overbought: {
              type: 'line' as const,
              yMin: 70,
              yMax: 70,
              borderColor: '#F6465D',
              borderWidth: 2,
              borderDash: [5, 5],
              label: {
                content: 'Overbought (70)',
                enabled: true,
                position: 'start' as const
              }
            },
            oversold: {
              type: 'line' as const,
              yMin: 30,
              yMax: 30,
              borderColor: '#2EBD85',
              borderWidth: 2,
              borderDash: [5, 5],
              label: {
                content: 'Oversold (30)',
                enabled: true,
                position: 'start' as const
              }
            },
            middle: {
              type: 'line' as const,
              yMin: 50,
              yMax: 50,
              borderColor: '#AEBCC2',
              borderWidth: 1,
              borderDash: [2, 2]
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
          type: 'time' as const,
          time: {
            // Parser tipindeki uyumsuzluğu önlemek için açıkça undefined bırakıyoruz (ms kullanıyoruz)
            parser: undefined as unknown as string | ((v: unknown) => number) | undefined,
            unit: chartData.interval === '1m' || chartData.interval === '5m' ? 'minute' as const :
                  chartData.interval === '1d' ? 'day' as const : 'hour' as const,
            minUnit: chartData.interval === '1m' || chartData.interval === '5m' ? 'minute' as const :
                     chartData.interval === '1d' ? 'day' as const : 'hour' as const,
            displayFormats: {
              minute: 'HH:mm',
              hour: 'MMM dd HH:mm',
              day: 'MMM dd'
            }
          },
          grid: {
            display: true,
            color: 'rgba(174, 188, 194, 0.1)'
          },
          ticks: {
            color: '#AEBCC2',
            maxTicksLimit: 10
          }
        },
        y: {
          min: 0,
          max: 100,
          display: true,
          position: 'right' as const,
          grid: {
            display: true,
            color: 'rgba(174, 188, 194, 0.1)'
          },
          ticks: {
            color: '#AEBCC2',
            stepSize: 10
          }
        }
      },
      interaction: {
        mode: 'nearest' as const,
        axis: 'x' as const,
        intersect: false
      }
    }
  }}, [chartData, rsiPeriod]) // CRITICAL FIX: Depend on full chartData to recreate when params change!

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'overbought': return 'text-red-500'
      case 'oversold': return 'text-green-500'
      default: return 'text-blue-500'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'overbought': return <TrendingDown className="w-4 h-4" />
      case 'oversold': return <TrendingUp className="w-4 h-4" />
      default: return <Activity className="w-4 h-4" />
    }
  }

  // Early returns after all hooks
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

  if (!chartData || !chartConfig) {
    return null
  }

  return (
    <div className="glass rounded-2xl shadow-lg border border-[var(--card-border)] bg-[var(--card-bg)]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--card-border)]">
        <div className="flex items-center justify-between flex-wrap gap-4">
          {/* Left: Title & Status */}
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5 text-blue-500" />
            <div>
              <h3 className="text-lg font-semibold text-[var(--foreground)]">RSI - Relative Strength Index</h3>
              <p className="text-xs text-[var(--muted)]">Momentum oscillator for overbought/oversold conditions</p>
            </div>
          </div>

          {/* Right: Controls */}
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

        {/* Timeframe & RSI Period Controls */}
        <div className="flex items-center justify-between mt-4 flex-wrap gap-4">
          {/* Timeframe Buttons */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--muted)] mr-2">Chart Timeframe:</span>
            {timeframes.map(tf => (
              <button
                key={tf}
                onClick={() => handleTimeframeChange(tf)}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                  selectedTimeframe === tf
                    ? 'bg-blue-500 text-white'
                    : 'bg-[var(--background)] text-[var(--foreground)] hover:bg-[var(--card-border)]'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          {/* RSI Period (Number of candles) */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--muted)]">RSI Period:</span>
            <select
              value={rsiPeriod}
              onChange={(e) => setRsiPeriod(Number(e.target.value))}
              className="px-3 py-1 border border-[var(--card-border)] rounded-lg text-sm bg-[var(--background)] text-[var(--foreground)] hover:border-blue-500"
            >
              {rsiPeriods.map(p => (
                <option key={p} value={p}>RSI({p})</option>
              ))}
            </select>
          </div>
        </div>

        {/* Statistics */}
        <div className="flex items-center gap-6 mt-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-[var(--muted)]">Current RSI: </span>
            <span className={`font-semibold text-lg ${getStatusColor(rsiStatus)}`}>
              {currentRSI.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[var(--muted)]">Status: </span>
            <div className={`flex items-center gap-1 ${getStatusColor(rsiStatus)}`}>
              {getStatusIcon(rsiStatus)}
              <span className="font-semibold uppercase">
                {rsiStatus}
              </span>
            </div>
          </div>
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
      </div>

      {/* Chart */}
      <div className="p-2 sm:p-4">
        <div className="h-64 sm:h-72 lg:h-80 relative">
          <Chart ref={chartRef} {...chartConfig} />
        </div>
        <div className="mt-2 text-xs text-[var(--muted)] text-center hidden sm:block">
          💡 Hold Ctrl + Mouse wheel to zoom, drag to pan • RSI {'>'} 70: Overbought • RSI {'<'} 30: Oversold • Chart follows {selectedTimeframe} candles
        </div>
      </div>
    </div>
  )
}

