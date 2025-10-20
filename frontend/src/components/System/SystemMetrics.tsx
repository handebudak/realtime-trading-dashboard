'use client'

import { useState, useEffect } from 'react'
import { Activity, Zap, AlertTriangle, CheckCircle } from 'lucide-react'

interface SystemMetrics {
  latency: number
  throughput: number
  errorRate: number
  uptime: number
}

export default function SystemMetrics() {
  const [metrics, setMetrics] = useState<SystemMetrics>({
    latency: 0,
    throughput: 0,
    errorRate: 0,
    uptime: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await fetch('http://localhost:3002/api/v1/system/metrics')
        const data = await response.json()
        
        if (data.success) {
          setMetrics({
            latency: data.data.performance.latency,
            throughput: data.data.performance.throughput,
            errorRate: data.data.performance.errorRate,
            uptime: data.data.performance.uptime || 0,
          })
        }
      } catch (error) {
        console.error('Failed to fetch system metrics:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchMetrics()
    
    // Update metrics every 30 seconds (reduced frequency)
    const interval = setInterval(fetchMetrics, 30000)
    
    return () => clearInterval(interval)
  }, [])

  const getStatusColor = (value: number, type: 'latency' | 'errorRate') => {
    if (type === 'latency') {
      if (value < 10) return 'text-[#2EBD85]'
      if (value < 50) return 'text-yellow-500'
      return 'text-[#F6465D]'
    }
    
    if (type === 'errorRate') {
      if (value < 0.1) return 'text-[#2EBD85]'
      if (value < 1) return 'text-yellow-500'
      return 'text-[#F6465D]'
    }
    
    return 'text-[var(--muted)]'
  }

  const getStatusIcon = (value: number, type: 'latency' | 'errorRate') => {
    if (type === 'latency') {
      if (value < 10) return <CheckCircle className="h-4 w-4 text-[#2EBD85]" />
      if (value < 50) return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      return <AlertTriangle className="h-4 w-4 text-[#F6465D]" />
    }
    
    if (type === 'errorRate') {
      if (value < 0.1) return <CheckCircle className="h-4 w-4 text-[#2EBD85]" />
      if (value < 1) return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      return <AlertTriangle className="h-4 w-4 text-[#F6465D]" />
    }
    
    return <Activity className="h-4 w-4 text-[var(--muted)]" />
  }

  if (loading) {
    return (
      <div className="glass rounded-2xl shadow-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6">
        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">System Metrics</h2>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-[var(--background)] rounded"></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="glass rounded-2xl shadow-2xl border border-[var(--card-border)] bg-[var(--card-bg)]">
      <div className="px-6 py-4 border-b border-[var(--card-border)]">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">System Metrics</h2>
      </div>
      
      <div className="p-6 space-y-3">
        {/* Throughput */}
        <div className="flex items-center justify-between p-3 bg-[var(--background)] rounded-lg">
          <div className="flex items-center">
            <Activity className="h-4 w-4 text-[#2EBD85] mr-3" />
            <div>
              <p className="text-sm font-medium text-[var(--foreground)]">Throughput</p>
              <p className="text-xs text-[var(--muted)]">Requests per second</p>
            </div>
          </div>
          <div className="flex items-center">
            <CheckCircle className="h-4 w-4 text-[#2EBD85]" />
            <span className="ml-2 text-sm font-semibold text-[#2EBD85] font-mono">
              {metrics.throughput} req/s
            </span>
          </div>
        </div>

        {/* Error Rate */}
        <div className="flex items-center justify-between p-3 bg-[var(--background)] rounded-lg">
          <div className="flex items-center">
            <AlertTriangle className="h-4 w-4 text-orange-500 mr-3" />
            <div>
              <p className="text-sm font-medium text-[var(--foreground)]">Error Rate</p>
              <p className="text-xs text-[var(--muted)]">Failed requests</p>
            </div>
          </div>
          <div className="flex items-center">
            {getStatusIcon(metrics.errorRate, 'errorRate')}
            <span className={`ml-2 text-sm font-semibold font-mono ${getStatusColor(metrics.errorRate, 'errorRate')}`}>
              {metrics.errorRate}%
            </span>
          </div>
        </div>

        {/* Uptime */}
        <div className="flex items-center justify-between p-3 bg-[var(--background)] rounded-lg">
          <div className="flex items-center">
            <CheckCircle className="h-4 w-4 text-[#2EBD85] mr-3" />
            <div>
              <p className="text-sm font-medium text-[var(--foreground)]">Uptime</p>
              <p className="text-xs text-[var(--muted)]">System availability</p>
            </div>
          </div>
          <div className="flex items-center">
            <CheckCircle className="h-4 w-4 text-[#2EBD85]" />
            <span className="ml-2 text-sm font-semibold text-[#2EBD85] font-mono">
              {metrics.uptime > 0 ? `${metrics.uptime.toFixed(1)}h` : '99.9%'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}