'use client'

import { useState, useEffect } from 'react'
import { api } from '@/services/apiClient'
import { AlertTriangle, X, CheckCircle, AlertCircle, Info } from 'lucide-react'

interface Alert {
  id: string
  type: 'LATENCY' | 'ERROR_RATE' | 'THROUGHPUT' | 'WEBSOCKET'
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  message: string
  value: number
  threshold: number
  timestamp: string
  acknowledged: boolean
}

export default function AlertNotifications() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [unacknowledgedCount, setUnacknowledgedCount] = useState(0)
  const [showAlerts, setShowAlerts] = useState(false)

  useEffect(() => {
    fetchAlerts()
    
    // Poll for new alerts every 30 seconds
    const interval = setInterval(fetchAlerts, 30000)
    
    return () => clearInterval(interval)
  }, [])

  const fetchAlerts = async () => {
    try {
      const data = await api.get('/api/v1/system/alerts', { params: { acknowledged: false } })
      
      if (data.success) {
        setAlerts(data.data.alerts)
        setUnacknowledgedCount(data.data.unacknowledgedCount)

        // Show browser notification for critical alerts
        if (data.data.alerts.length > 0 && Notification.permission === 'granted') {
          const criticalAlerts = data.data.alerts.filter((a: Alert) => a.severity === 'CRITICAL' && !a.acknowledged)
          criticalAlerts.forEach((alert: Alert) => {
            new Notification('Critical Alert', {
              body: alert.message,
              icon: '/alert-icon.png',
              tag: alert.id
            })
          })
        }
      }
    } catch (error) {
      console.error('Failed to fetch alerts:', error)
    }
  }

  const acknowledgeAlert = async (alertId: string) => {
    try {
      await api.post(`/api/v1/system/alerts/${alertId}/acknowledge`)
      setAlerts(prev => {
        const filtered = prev.filter(a => a.id !== alertId)
        // Eğer son alert'ti ise paneli kapat
        if (filtered.length === 0) {
          setShowAlerts(false)
        }
        return filtered
      })
      setUnacknowledgedCount(prev => Math.max(0, prev - 1))
    } catch (error) {
      console.error('Failed to acknowledge alert:', error)
    }
  }

  const acknowledgeAll = async () => {
    try {
      await api.post('/api/v1/system/alerts/acknowledge-all')
      setAlerts([])
      setUnacknowledgedCount(0)
      setShowAlerts(false)
    } catch (error) {
      console.error('Failed to acknowledge all alerts:', error)
    }
  }

  const requestNotificationPermission = () => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }

  useEffect(() => {
    requestNotificationPermission()
  }, [])

  const getIcon = (severity: Alert['severity']) => {
    switch (severity) {
      case 'CRITICAL':
        return <AlertTriangle className="h-5 w-5 text-[#F6465D]" />
      case 'HIGH':
        return <AlertCircle className="h-5 w-5 text-orange-500" />
      case 'MEDIUM':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />
      case 'LOW':
        return <Info className="h-5 w-5 text-blue-500" />
      default:
        return <Info className="h-5 w-5" />
    }
  }

  const getColor = (severity: Alert['severity']) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-[#F6465D]/10 border-[#F6465D]/30 text-[#F6465D]'
      case 'HIGH':
        return 'bg-orange-500/10 border-orange-500/30 text-orange-500'
      case 'MEDIUM':
        return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500'
      case 'LOW':
        return 'bg-blue-500/10 border-blue-500/30 text-blue-500'
      default:
        return 'bg-[var(--card-bg)] border-[var(--card-border)] text-[var(--foreground)]'
    }
  }

  if (unacknowledgedCount === 0) {
    return null
  }

  return (
    <>
      {/* Alert Badge */}
      <button
        onClick={() => setShowAlerts(!showAlerts)}
        className="fixed top-16 sm:top-20 right-2 sm:right-4 z-50 flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 bg-[#F6465D] text-white rounded-lg shadow-lg hover:bg-[#F6465D]/90 transition-all"
      >
        <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5" />
        <span className="font-semibold text-xs sm:text-sm">{unacknowledgedCount} Alert{unacknowledgedCount > 1 ? 's' : ''}</span>
      </button>

      {/* Alert Panel */}
      {showAlerts && (
        <>
          {/* Backdrop - Dışına tıklayınca kapat */}
          <div 
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
            onClick={() => setShowAlerts(false)}
          />
          
          <div className="fixed top-28 sm:top-32 right-2 sm:right-4 left-2 sm:left-auto z-50 w-auto sm:w-96 max-h-[calc(100vh-120px)] sm:max-h-[calc(100vh-140px)] overflow-y-auto bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl shadow-2xl">
          {/* Header */}
          <div className="sticky top-0 bg-[var(--card-bg)] border-b border-[var(--card-border)] p-2 sm:p-4 flex items-center justify-between">
            <div className="flex items-center gap-1 sm:gap-2">
              <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-[#F6465D]" />
              <h3 className="font-semibold text-sm sm:text-base text-[var(--foreground)]">System Alerts</h3>
              <span className="px-1.5 sm:px-2 py-0.5 bg-[#F6465D]/20 text-[#F6465D] rounded-full text-xs font-semibold">
                {unacknowledgedCount}
              </span>
            </div>
            <button
              onClick={() => setShowAlerts(false)}
              className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors p-1"
            >
              <X className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          </div>

          {/* Alerts List */}
          <div className="p-2 sm:p-4 space-y-2 sm:space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-3 rounded-lg border ${getColor(alert.severity)}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 flex-1">
                    {getIcon(alert.severity)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold uppercase">{alert.severity}</span>
                        <span className="text-xs text-[var(--muted)]">•</span>
                        <span className="text-xs text-[var(--muted)]">{alert.type.replace('_', ' ')}</span>
                      </div>
                      <p className="text-sm font-medium text-[var(--foreground)] break-words">
                        {alert.message}
                      </p>
                      <p className="text-xs text-[var(--muted)] mt-1">
                        {new Date(alert.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => acknowledgeAlert(alert.id)}
                    className="flex-shrink-0 p-1 hover:bg-[var(--background)] rounded transition-colors"
                    title="Acknowledge"
                  >
                    <CheckCircle className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          {alerts.length > 1 && (
            <div className="sticky bottom-0 bg-[var(--card-bg)] border-t border-[var(--card-border)] p-4">
              <button
                onClick={acknowledgeAll}
                className="w-full px-4 py-2 bg-[var(--background)] hover:bg-[var(--background)]/80 text-[var(--foreground)] rounded-lg transition-colors text-sm font-medium"
              >
                Acknowledge All
              </button>
            </div>
          )}
        </div>
        </>
      )}
    </>
  )
}

