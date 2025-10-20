'use client'

import MainLayout from '@/components/Layout/MainLayout'
import MarketDataOverview from '@/components/MarketData/MarketDataOverview'
import TradingInterface from '@/components/Trading/TradingInterface'
import SystemMetrics from '@/components/System/SystemMetrics'
import RecentTrades from '@/components/Trading/RecentTrades'

export default function Dashboard() {
  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Main Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Market Data Overview */}
          <div className="lg:col-span-2">
            <MarketDataOverview />
          </div>

          {/* Trading Interface */}
          <div>
            <TradingInterface />
          </div>
        </div>

        {/* Secondary Grid - Equal Height */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
          {/* System Metrics */}
          <div className="h-fit">
            <SystemMetrics />
          </div>

          {/* Recent Trades - Match System Metrics height */}
          <div className="h-fit">
            <RecentTrades />
          </div>
        </div>
      </div>
    </MainLayout>
  )
}