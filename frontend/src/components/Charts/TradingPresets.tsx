'use client'

import React from 'react'
import { Zap, TrendingUp, Target, Building2, Crown } from 'lucide-react'

interface TradingPreset {
  id: string
  name: string
  interval: string
  period: string
  description: string
  icon: React.ReactNode
  color: string
  bgColor: string
  borderColor: string
}

interface TradingPresetsProps {
  onPresetSelect?: (interval: string, period: string) => void
}

const TRADING_PRESETS: TradingPreset[] = [
  {
    id: 'day-trading',
    name: 'Day Trading',
    interval: '15m',
    period: '4h',
    description: 'Intraday trading',
    icon: <Zap />,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20'
  },
  {
    id: 'swing-trading',
    name: 'Swing Trading',
    interval: '1h',
    period: 'weekly',
    description: 'Medium-term positions',
    icon: <TrendingUp />,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/20'
  },
  {
    id: 'scalping',
    name: 'Scalping',
    interval: '5m',
    period: 'hourly',
    description: 'Quick profit taking',
    icon: <Target />,
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/20'
  },
  {
    id: 'position-trading',
    name: 'Position Trading',
    interval: '1d',
    period: 'monthly',
    description: 'Long-term investment',
    icon: <Building2 />,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/20'
  },
  {
    id: 'long-term-investment',
    name: 'Long-term Investment',
    interval: '1d',
    period: 'yearly',
    description: 'Annual investment strategy',
    icon: <Crown />,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/20'
  }
]

export default function TradingPresets({ onPresetSelect }: TradingPresetsProps) {
  const [activePreset, setActivePreset] = React.useState<string>('day-trading')

  const isPresetActive = (preset: TradingPreset) => {
    return preset.id === activePreset
  }

  return (
    <div className="glass rounded-2xl shadow-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-3 sm:p-4">
      <div className="mb-3">
        <h3 className="text-base font-semibold text-[var(--foreground)] mb-1">Trading Strategies</h3>
        <p className="text-xs text-[var(--muted)] hidden lg:block">Ready settings for professional trading strategies</p>
      </div>
      
      {/* All screens: responsive compact row */}
      <div className="grid grid-cols-5 gap-2 lg:gap-3 place-items-stretch">
        {TRADING_PRESETS.map((preset) => {
          const isActive = isPresetActive(preset)
          
          return (
            <button
              key={preset.id}
              onClick={() => {
                setActivePreset(preset.id)
                if (onPresetSelect) {
                  onPresetSelect(preset.interval, preset.period)
                }
              }}
              className={`
                relative overflow-hidden aspect-square lg:aspect-auto w-full lg:h-12 xl:h-14 px-2 lg:px-3 py-2 rounded-lg border transition-all duration-200 group
                flex flex-col lg:flex-row items-center justify-center lg:justify-start gap-1 lg:gap-3
                ${isActive 
                  ? `${preset.bgColor} ${preset.borderColor} ${preset.color} shadow` 
                  : 'bg-[var(--background)] border-[var(--card-border)] hover:border-[var(--primary)]/40'
                }
              `}
            >
              {/* Active indicator */}
              {isActive && (
                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border border-[var(--card-bg)]"></div>
              )}
              
              {/* Icon */}
              <div className={`
                flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-md transition-colors
                ${isActive 
                  ? `${preset.bgColor} ${preset.color}` 
                  : 'bg-[var(--card-border)] text-[var(--muted)] group-hover:bg-[var(--primary)]/10 group-hover:text-[var(--primary)]'
                }
              `}>
                {/* TS: some lucide icons types narrow props; wrap in span */}
                <span className="w-3.5 h-3.5 inline-flex items-center justify-center">
                  {preset.icon}
                </span>
              </div>
              
              {/* Title */}
              <div className="text-center lg:text-left w-full min-w-0">
                <h4 className={`
                  font-semibold text-[10px] leading-tight truncate
                  ${isActive ? preset.color : 'text-[var(--foreground)]'}
                `}>
                  {preset.name}
                </h4>
              </div>

              {/* Badges only on very large screens */}
              <div className="hidden xl:flex ml-auto items-center gap-1 text-[10px] whitespace-nowrap">
                <span className="px-1 py-0.5 bg-[var(--card-border)] rounded text-[var(--muted)]">
                  {preset.interval}
                </span>
                <span className="px-1 py-0.5 bg-[var(--card-border)] rounded text-[var(--muted)]">
                  {preset.period}
                </span>
              </div>
            </button>
          )
        })}
      </div>
      
    </div>
  )
}
