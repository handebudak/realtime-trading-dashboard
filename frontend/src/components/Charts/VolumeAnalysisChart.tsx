'use client'

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Chart as ChartJS, registerables } from 'chart.js'
import { Chart } from 'react-chartjs-2'
import zoomPlugin from 'chartjs-plugin-zoom'
import 'chartjs-adapter-date-fns'
import { BarChart, TrendingUp, TrendingDown, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'
import { useWebSocket } from '@/hooks/useWebSocket'
import { api } from '@/services/apiClient'

ChartJS.register(...registerables, zoomPlugin)

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

interface VolumeAnalysisChartProps {
  symbol?: string
}

interface ChartData {
  symbol: string
  interval: string
  period: string
  klines: Kline[]
  total: number
}

export default function VolumeAnalysisChart({ symbol: propSymbol }: VolumeAnalysisChartProps) {
  const [selectedSymbol, setSelectedSymbol] = useState('BTCUSDT')
  const [selectedTimeframe, setSelectedTimeframe] = useState('15m') // Main chart timeframe
  const [showMA, setShowMA] = useState(true) // Volume MA(20) toggle
  const [chartData, setChartData] = useState<ChartData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalVolume, setTotalVolume] = useState(0)
  const [avgVolume, setAvgVolume] = useState(0)
  const chartRef = useRef<ChartJS>(null)
  const chartDataRef = useRef<ChartData | null>(null)

  const symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT']
  const timeframes = ['1m', '5m', '15m', '1h', '4h', '1d']
  const volumeMAperiod = 20 // Standard Volume MA period
  
  // Fetch reasonable number of candles for display
  const getCandleLimit = (): number => {
    return 150 // Show last 150 candles like real trading platforms
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

  // Real-time chart update function - using imperative API and refs
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
      
      // Update internal klines array
      const updatedKlines = [...currentChartData.klines, {
        openTime: newKline.openTime, // Already in milliseconds from WebSocket
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
      
      // Keep max candles
      const maxCandles = getCandleLimit()
      if (updatedKlines.length > maxCandles) {
        updatedKlines.shift()
      }
      
      // Add new data point directly to chart (imperative)
      // Normalize to milliseconds before adding
      const normalizedOpenTime = newKline.openTime < 1e12 ? newKline.openTime * 1000 : newKline.openTime
      chart.data.labels?.push(normalizedOpenTime)
      chart.data.datasets[0]?.data.push(parseFloat(newKline.volume))
      
      // Update MA if enabled
      if (showMA && chart.data.datasets[1]) {
        // Recalculate last MA value
        const volumes = chart.data.datasets[0].data as number[]
        if (volumes.length >= volumeMAperiod) {
          const sum = volumes.slice(-volumeMAperiod).reduce((acc, v) => acc + v, 0)
          chart.data.datasets[1].data.push(sum / volumeMAperiod)
        } else {
          chart.data.datasets[1].data.push(null)
        }
      }
      
      // Keep appropriate number of data points
      if (chart.data.labels && chart.data.labels.length > maxCandles) {
        chart.data.labels.shift()
        chart.data.datasets.forEach(dataset => dataset.data.shift())
      }
      
      // Update chart without animation (preserves zoom)
      chart.update('none')
      
      // Update statistics in state (doesn't trigger chart re-render)
      const volumes = chart.data.datasets[0].data as number[]
      const total = volumes.reduce((sum, v) => sum + (v as number), 0)
      setTotalVolume(total)
      setAvgVolume(total / volumes.length)
      
      // Update chartData state properly
      const newChartData = { ...currentChartData, klines: updatedKlines }
      chartDataRef.current = newChartData
      setChartData(newChartData)
    }
  }, [showMA, volumeMAperiod])

  // WebSocket message handler
  const handleWebSocketMessage = useCallback((message: any) => {
    if (message.type === 'kline' && chartDataRef.current && message.data.isClosed) {
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

        // Fetch candles based on standard limit (150 candles)
        const limit = getCandleLimit()
        
        // Fetch klines directly from Binance via our backend
        const result = await api.get<any>('/api/v1/market-data/klines', { params: { symbol: selectedSymbol, interval: selectedTimeframe, limit } })

        if (result.success && result.data.klines && result.data.klines.length > 0) {
          // CRITICAL FIX: Ensure all timestamps are in milliseconds (13 digits)
          const normalizedKlines = result.data.klines.map((k: Kline) => ({
            ...k,
            openTime: k.openTime < 1e12 ? k.openTime * 1000 : k.openTime,
            closeTime: k.closeTime < 1e12 ? k.closeTime * 1000 : k.closeTime
          }))
          
          const newData = {
            symbol: selectedSymbol,
            interval: selectedTimeframe,
            period: `${limit} candles`, // For display only
            klines: normalizedKlines,
            total: normalizedKlines.length
          }

          // Update both state and ref
          chartDataRef.current = newData
          setChartData(newData)

          // Calculate statistics
          const total = result.data.klines.reduce((sum: number, k: Kline) => sum + parseFloat(k.volume), 0)
          setTotalVolume(total)
          setAvgVolume(total / result.data.klines.length)
        } else {
          setError(result.message || 'Failed to fetch data')
        }
      } catch (err) {
        setError('Network error occurred')
        console.error('Volume chart error:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [selectedSymbol, selectedTimeframe])

  const formatVolume = (value: number) => {
    if (value >= 1000000000) {
      return `${(value / 1000000000).toFixed(2)}B`
    } else if (value >= 1000000) {
      return `${(value / 1000000).toFixed(2)}M`
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(2)}K`
    }
    return value.toFixed(0)
  }

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Calculate Volume MA - helper function
  const calculateVolumeMA = useCallback((klines: Kline[]) => {
    const ma: (number | null)[] = []
    for (let i = 0; i < klines.length; i++) {
      if (i < volumeMAperiod - 1) {
        ma.push(null)
      } else {
        const sum = klines.slice(i - volumeMAperiod + 1, i + 1).reduce((acc, k) => acc + parseFloat(k.volume), 0)
        ma.push(sum / volumeMAperiod)
      }
    }
    return ma
  }, [volumeMAperiod])

  // Chart config created ONCE - only depends on settings, not data!
  const chartConfig = useMemo(() => {
    if (!chartData) return null
    
    // Initial data calculations
    const volumeData = chartData.klines.map(kline => parseFloat(kline.volume))
    const volumeMA = calculateVolumeMA(chartData.klines)
    const volumeColors = chartData.klines.map(kline => {
      return parseFloat(kline.close) >= parseFloat(kline.open) ? '#2EBD85' : '#F6465D'
    })
    
    return {
    type: 'bar' as const,
    data: {
      labels: chartData.klines.map(k => k.openTime),
      datasets: [
        {
          label: 'Volume',
          data: volumeData,
          backgroundColor: volumeColors,
          borderWidth: 0,
          yAxisID: 'y'
        },
        ...(showMA ? [{
          label: `Volume MA (${volumeMAperiod})`,
          data: volumeMA,
          type: 'line' as const,
          borderColor: '#FFA500',
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 0,
          yAxisID: 'y'
        }] : [])
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
            color: '#AEBCC2',
            usePointStyle: true
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
              if (context.dataset.label === 'Volume') {
                return `Volume: ${formatVolume(context.parsed.y)}`
              }
              return `MA(${volumeMAperiod}): ${formatVolume(context.parsed.y)}`
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
          display: true,
          position: 'right' as const,
          grid: {
            display: true,
            color: 'rgba(174, 188, 194, 0.1)'
          },
          ticks: {
            color: '#AEBCC2',
            callback: function(value: any) {
              return formatVolume(value)
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
  }}, [chartData, showMA, volumeMAperiod, calculateVolumeMA]) // Recreate when data or settings change

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
          {/* Left: Symbol & Title */}
          <div className="flex items-center gap-3">
            <BarChart className="w-5 h-5 text-blue-500" />
            <div>
              <h3 className="text-lg font-semibold text-[var(--foreground)]">Volume Analysis</h3>
              <p className="text-xs text-[var(--muted)]">Trading volume with moving average</p>
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

        {/* Timeframe & MA Toggle Controls */}
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

          {/* MA Toggle */}
          <button
            onClick={() => setShowMA(!showMA)}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
              showMA
                ? 'bg-orange-500 text-white'
                : 'bg-[var(--background)] text-[var(--foreground)] hover:bg-[var(--card-border)]'
            }`}
          >
            MA({volumeMAperiod})
          </button>
        </div>

        {/* Statistics */}
        <div className="flex items-center gap-6 mt-4 text-sm">
          <div>
            <span className="text-[var(--muted)]">Total Volume: </span>
            <span className="text-[var(--foreground)] font-semibold">{formatVolume(totalVolume)}</span>
          </div>
          <div>
            <span className="text-[var(--muted)]">Avg Volume: </span>
            <span className="text-[var(--foreground)] font-semibold">{formatVolume(avgVolume)}</span>
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
        <div className="h-64 sm:h-80 lg:h-96 relative">
          <Chart ref={chartRef} {...chartConfig} />
        </div>
        <div className="mt-2 text-xs text-[var(--muted)] text-center hidden sm:block">
          💡 Hold Ctrl + Mouse wheel to zoom, drag to pan • Chart follows {selectedTimeframe} candles
        </div>
      </div>
    </div>
  )
}

