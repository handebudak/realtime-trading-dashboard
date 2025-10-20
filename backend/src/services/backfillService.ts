import { binanceService } from './binanceService'
import { clickhouseService } from './clickhouseService'
import { logger } from '../utils/logger'

interface BackfillConfig {
  symbols: string[]
  intervals: string[]
  days: number
}

class BackfillService {
  // Default configuration for demo
  private defaultConfig: BackfillConfig = {
    symbols: ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT'],
    intervals: ['1m', '5m', '15m', '1h', '4h', '1d'],
    days: 7 // Last 7 days
  }

  /**
   * Backfill historical klines from Binance to ClickHouse
   * This is called on server startup to ensure we have historical data
   */
  async backfillHistoricalData(config?: Partial<BackfillConfig>): Promise<void> {
    const finalConfig = { ...this.defaultConfig, ...config }
    
    logger.info('🔄 Starting historical data backfill...')
    logger.info(`📊 Config: ${finalConfig.symbols.length} symbols, ${finalConfig.intervals.length} intervals, ${finalConfig.days} days`)

    const startTime = Date.now() - (finalConfig.days * 24 * 60 * 60 * 1000)
    const endTime = Date.now()

    let totalInserted = 0
    let totalErrors = 0

    for (const symbol of finalConfig.symbols) {
      for (const interval of finalConfig.intervals) {
        try {
          logger.info(`📥 Fetching ${symbol} ${interval} data from Binance...`)
          
          // Fetch klines from Binance
          const klines = await binanceService.getKlines(
            symbol,
            interval,
            startTime,
            endTime,
            1000 // Max limit per request
          )

          if (!klines || klines.length === 0) {
            logger.warn(`⚠️ No data received for ${symbol} ${interval}`)
            continue
          }

          logger.info(`✅ Received ${klines.length} klines for ${symbol} ${interval}`)

          // Transform Binance format to ClickHouse format
          // Binance returns array: [openTime, open, high, low, close, volume, closeTime, quoteVolume, trades, takerBuyBaseVolume, takerBuyQuoteVolume]
          const transformedData = klines.map((k: any) => ({
            symbol: symbol,
            interval: interval,
            open_time: new Date(k[0]).toISOString(), // k[0] = openTime
            close_time: new Date(k[6]).toISOString(), // k[6] = closeTime
            open_price: parseFloat(k[1]), // k[1] = open
            high_price: parseFloat(k[2]), // k[2] = high
            low_price: parseFloat(k[3]),  // k[3] = low
            close_price: parseFloat(k[4]), // k[4] = close
            volume: parseFloat(k[5]),      // k[5] = volume
            quote_volume: parseFloat(k[7]), // k[7] = quoteAssetVolume
            trades_count: k[8],            // k[8] = numberOfTrades
            taker_buy_base_volume: parseFloat(k[9]),  // k[9] = takerBuyBaseAssetVolume
            taker_buy_quote_volume: parseFloat(k[10]), // k[10] = takerBuyQuoteAssetVolume
            created_at: new Date().toISOString()
          }))

          // Insert to ClickHouse (with duplicate prevention)
          await clickhouseService.batchInsertMarketData(transformedData)
          
          // Note: batchInsertMarketData already filters duplicates internally
          totalInserted += transformedData.length
          
          logger.info(`💾 Processed ${symbol} ${interval} successfully`)

          // Small delay to avoid rate limiting
          await this.delay(200)
        } catch (error: any) {
          totalErrors++
          logger.error(`❌ Error backfilling ${symbol} ${interval}:`, {
            message: error.message,
            code: error.code,
            type: error.type,
            stack: error.stack
          })
          // Continue with next symbol/interval even if one fails
        }
      }
    }

    logger.info('✅ Historical data backfill completed!')
    logger.info(`📊 Summary: Processed ${totalInserted} klines, ${totalErrors} errors`)
  }

  /**
   * Backfill specific symbol and interval
   * Useful for on-demand backfill when user requests historical data
   */
  async backfillSymbolInterval(
    symbol: string,
    interval: string,
    days: number = 7
  ): Promise<number> {
    try {
      logger.info(`🔄 Backfilling ${symbol} ${interval} for last ${days} days...`)

      const startTime = Date.now() - (days * 24 * 60 * 60 * 1000)
      const endTime = Date.now()

      // Fetch from Binance
      const klines = await binanceService.getKlines(
        symbol,
        interval,
        startTime,
        endTime,
        1000
      )

      if (!klines || klines.length === 0) {
        logger.warn(`⚠️ No data received for ${symbol} ${interval}`)
        return 0
      }

      // Transform to ClickHouse format
      // Binance returns array: [openTime, open, high, low, close, volume, closeTime, quoteVolume, trades, takerBuyBaseVolume, takerBuyQuoteVolume]
      const transformedData = klines.map((k: any) => ({
        symbol: symbol,
        interval: interval,
        open_time: new Date(k[0]).toISOString(),
        close_time: new Date(k[6]).toISOString(),
        open_price: parseFloat(k[1]),
        high_price: parseFloat(k[2]),
        low_price: parseFloat(k[3]),
        close_price: parseFloat(k[4]),
        volume: parseFloat(k[5]),
        quote_volume: parseFloat(k[7]),
        trades_count: k[8],
        taker_buy_base_volume: parseFloat(k[9]),
        taker_buy_quote_volume: parseFloat(k[10]),
        created_at: new Date().toISOString()
      }))

      // Insert to ClickHouse
      await clickhouseService.batchInsertMarketData(transformedData)

      logger.info(`✅ Backfilled ${transformedData.length} klines for ${symbol} ${interval}`)
      return transformedData.length
    } catch (error: any) {
      logger.error(`❌ Error backfilling ${symbol} ${interval}:`, error.message)
      throw error
    }
  }

  /**
   * Check if data exists for a symbol/interval in ClickHouse
   */
  async hasHistoricalData(symbol: string, interval: string): Promise<boolean> {
    try {
      const data = await clickhouseService.getHistoricalKlines(
        symbol,
        interval,
        undefined,
        undefined,
        1
      )
      return data.length > 0
    } catch (error) {
      logger.error('Error checking historical data:', error)
      return false
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

export const backfillService = new BackfillService()
export default backfillService

