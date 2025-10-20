'use client'

import { useState } from 'react'
import MainLayout from '@/components/Layout/MainLayout'
import TradingPresets from '@/components/Charts/TradingPresets'
import DayTradingChart from '@/components/Charts/DayTradingChart'
import SwingTradingChart from '@/components/Charts/SwingTradingChart'
import ScalpingChart from '@/components/Charts/ScalpingChart'
import PositionTradingChart from '@/components/Charts/PositionTradingChart'
import LongTermInvestmentChart from '@/components/Charts/LongTermInvestmentChart'
import VolumeAnalysisChart from '@/components/Charts/VolumeAnalysisChart'
import RSIChart from '@/components/Charts/RSIChart'

export default function HistoricalPage() {
  const [activeStrategy, setActiveStrategy] = useState('day-trading')

  const handlePresetSelect = (interval: string, period: string) => {
    // Determine strategy based on interval and period
    if (interval === '15m' && period === '4h') {
      setActiveStrategy('day-trading')
    } else if (interval === '1h' && period === 'weekly') {
      setActiveStrategy('swing-trading')
    } else if (interval === '5m' && period === 'hourly') {
      setActiveStrategy('scalping')
    } else if (interval === '1d' && period === 'monthly') {
      setActiveStrategy('position-trading')
    } else if (interval === '1d' && period === 'yearly') {
      setActiveStrategy('long-term-investment')
    }
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Trading Presets */}
        <TradingPresets onPresetSelect={handlePresetSelect} />

        {/* Charts Grid */}
        <div className="space-y-6">
          {/* Main Chart */}
          <div>
            {activeStrategy === 'day-trading' && (
              <DayTradingChart />
            )}
            {activeStrategy === 'swing-trading' && (
              <SwingTradingChart />
            )}
            {activeStrategy === 'scalping' && (
              <ScalpingChart />
            )}
            {activeStrategy === 'position-trading' && (
              <PositionTradingChart />
            )}
            {activeStrategy === 'long-term-investment' && (
              <LongTermInvestmentChart />
            )}
          </div>
          
          {/* Volume Analysis Chart */}
          <div>
            <VolumeAnalysisChart />
          </div>

          {/* RSI Performance Chart */}
          <div>
            <RSIChart />
          </div>
        </div>
      </div>
    </MainLayout>
  )
}