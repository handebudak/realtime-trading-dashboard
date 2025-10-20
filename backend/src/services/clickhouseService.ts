import { createClient, ClickHouseClient } from '@clickhouse/client';
import { config } from '../config/environment';

class ClickHouseService {
  private client: ClickHouseClient;

  constructor() {
    this.client = createClient({
      host: `http://${config.CLICKHOUSE.HOST}:${config.CLICKHOUSE.PORT}`,
      database: config.CLICKHOUSE.DATABASE,
      username: config.CLICKHOUSE.USERNAME,
      password: config.CLICKHOUSE.PASSWORD,
      clickhouse_settings: {
        input_format_skip_unknown_fields: 1,
        input_format_json_infer_incomplete_types_as_strings: 1,
        input_format_json_read_numbers_as_strings: 1
      }
    });
  }

  // Insert market data (klines)
  async insertMarketData(data: any[]): Promise<void> {
    try {
      // Clean data and convert ISO to Unix timestamp for ClickHouse
      const cleanData = data.map(row => ({
        symbol: String(row.symbol),
        interval: String(row.interval),
        open_time: Math.floor(new Date(row.open_time).getTime() / 1000),
        close_time: Math.floor(new Date(row.close_time).getTime() / 1000),
        open_price: Number(row.open_price),
        high_price: Number(row.high_price),
        low_price: Number(row.low_price),
        close_price: Number(row.close_price),
        volume: Number(row.volume),
        quote_volume: Number(row.quote_volume),
        trades_count: Number(row.trades_count),
        taker_buy_base_volume: Number(row.taker_buy_base_volume),
        taker_buy_quote_volume: Number(row.taker_buy_quote_volume),
        created_at: Math.floor(new Date().getTime() / 1000)
      }));

      await this.client.insert({
        table: 'market_data',
        values: cleanData,
        format: 'JSONEachRow'
      });
    } catch (error) {
      console.error('Error inserting market data:', error);
      throw error;
    }
  }

  // Batch insert market data with duplicate prevention
  async batchInsertMarketData(data: any[]): Promise<void> {
    if (data.length === 0) {
      return
    }

    try {
      // Step 1: Filter out duplicates by checking existing data
      const uniqueData = await this.filterDuplicates(data)
      
      if (uniqueData.length === 0) {
        console.log('⏭️ All klines already exist in ClickHouse, skipping insert')
        return
      }

      // Step 2: Clean and insert unique data (convert ISO to Unix timestamp for ClickHouse)
      const cleanData = uniqueData.map(row => ({
        symbol: String(row.symbol),
        interval: String(row.interval),
        open_time: Math.floor(new Date(row.open_time).getTime() / 1000), // Unix timestamp in seconds
        close_time: Math.floor(new Date(row.close_time).getTime() / 1000),
        open_price: Number(row.open_price),
        high_price: Number(row.high_price),
        low_price: Number(row.low_price),
        close_price: Number(row.close_price),
        volume: Number(row.volume),
        quote_volume: Number(row.quote_volume),
        trades_count: Number(row.trades_count),
        taker_buy_base_volume: Number(row.taker_buy_base_volume),
        taker_buy_quote_volume: Number(row.taker_buy_quote_volume),
        created_at: Math.floor(new Date().getTime() / 1000)
      }))

      await this.client.insert({
        table: 'market_data',
        values: cleanData,
        format: 'JSONEachRow'
      })

      console.log(`✅ Batch inserted ${cleanData.length} unique klines (filtered ${data.length - cleanData.length} duplicates)`)
    } catch (error) {
      console.error('❌ Error batch inserting market data:', error)
      throw error
    }
  }

  // Filter out duplicate klines (check if already exists in ClickHouse)
  private async filterDuplicates(data: any[]): Promise<any[]> {
    if (data.length === 0) {
      return []
    }

    try {
      // Group data by symbol and interval for efficient query
      const groupedData = new Map<string, any[]>()
      
      data.forEach(kline => {
        const key = `${kline.symbol}_${kline.interval}`
        if (!groupedData.has(key)) {
          groupedData.set(key, [])
        }
        groupedData.get(key)!.push(kline)
      })

      const uniqueKlines: any[] = []

      // Check each group against ClickHouse
      for (const [key, klines] of groupedData) {
        const [symbol, interval] = key.split('_')
        
        // Get min and max open_time for this group
        const openTimes = klines.map(k => new Date(k.open_time).getTime())
        const minTime = Math.min(...openTimes)
        const maxTime = Math.max(...openTimes)

        // Query ClickHouse for existing klines in this time range
        const query = `
          SELECT open_time
          FROM market_data
          WHERE symbol = {symbol:String}
          AND interval = {interval:String}
          AND toUnixTimestamp64Milli(open_time) >= {minTime:UInt64}
          AND toUnixTimestamp64Milli(open_time) <= {maxTime:UInt64}
        `

        const result = await this.client.query({
          query,
          query_params: {
            symbol,
            interval,
            minTime: minTime,
            maxTime: maxTime
          },
          format: 'JSONEachRow'
        })

        const existingTimes = new Set(
          (await result.json() as any[]).map((row: any) => 
            new Date(row.open_time).toISOString()
          )
        )

        // Filter out klines that already exist
        const newKlines = klines.filter(k => !existingTimes.has(k.open_time))
        uniqueKlines.push(...newKlines)
      }

      return uniqueKlines
    } catch (error) {
      console.error('❌ Error filtering duplicates:', error)
      // On error, return all data (better to have duplicates than lose data)
      return data
    }
  }

  // Insert trades
  async insertTrades(data: any[]): Promise<void> {
    try {
      await this.client.insert({
        table: 'trades',
        values: data,
        format: 'JSONEachRow'
      });
    } catch (error) {
      console.error('Error inserting trades:', error);
      throw error;
    }
  }

  // Insert orders
  async insertOrders(data: any[]): Promise<void> {
    try {
      await this.client.insert({
        table: 'orders',
        values: data,
        format: 'JSONEachRow'
      });
    } catch (error) {
      console.error('Error inserting orders:', error);
      throw error;
    }
  }

  // Insert performance metrics
  async insertPerformanceMetrics(data: any[]): Promise<void> {
    try {
      await this.client.insert({
        table: 'performance_metrics',
        values: data,
        format: 'JSONEachRow'
      });
    } catch (error) {
      console.error('Error inserting performance metrics:', error);
      throw error;
    }
  }

  // Insert volume data
  async insertVolumeData(data: any[]): Promise<void> {
    try {
      await this.client.insert({
        table: 'volume_data',
        values: data,
        format: 'JSONEachRow'
      });
    } catch (error) {
      console.error('Error inserting volume data:', error);
      throw error;
    }
  }

  // Get historical klines
  async getHistoricalKlines(
    symbol: string,
    interval: string,
    startTime?: string,
    endTime?: string,
    limit: number = 1000,
    period?: string
  ): Promise<any[]> {
    try {
      let query = `
        SELECT 
          symbol,
          interval,
          toUnixTimestamp(open_time) * 1000 as open_time,
          toUnixTimestamp(close_time) * 1000 as close_time,
          open_price,
          high_price,
          low_price,
          close_price,
          volume,
          quote_volume,
          trades_count,
          taker_buy_base_volume,
          taker_buy_quote_volume,
          created_at
        FROM market_data 
        WHERE symbol = {symbol:String} 
        AND interval = {interval:String}
      `;

      const params: any = {
        symbol,
        interval
      };

      if (startTime) {
        // Convert ISO string to Unix timestamp (seconds)
        const startTimeUnix = Math.floor(new Date(startTime).getTime() / 1000);
        query += ' AND toUnixTimestamp(open_time) >= {startTime:UInt32}';
        params.startTime = startTimeUnix;
      }

      if (endTime) {
        // Convert ISO string to Unix timestamp (seconds)
        const endTimeUnix = Math.floor(new Date(endTime).getTime() / 1000);
        query += ' AND toUnixTimestamp(open_time) <= {endTime:UInt32}';
        params.endTime = endTimeUnix;
      }

      // Apply period-based limit if period is specified
      let actualLimit = limit;
      if (period) {
        if (period === 'hourly') {
          // For hourly period, get appropriate data points based on interval
          if (interval === '1m') actualLimit = 60;      // 1 hour = 60 minutes
          else if (interval === '5m') actualLimit = 12; // 1 hour = 12 * 5min
          else if (interval === '15m') actualLimit = 4; // 1 hour = 4 * 15min
          else if (interval === '1h') actualLimit = 1;  // 1 hour = 1 * 1hour
          else actualLimit = 24;
        } else if (period === '4h') {
          // 4 hour period
          if (interval === '1m') actualLimit = 240;     // 4 hours = 240 minutes
          else if (interval === '5m') actualLimit = 48;  // 4 hours = 48 * 5min
          else if (interval === '15m') actualLimit = 16; // 4 hours = 16 * 15min
          else if (interval === '1h') actualLimit = 4;   // 4 hours = 4 * 1hour
          else actualLimit = 24;
        } else if (period === 'daily') {
          if (interval === '1m') actualLimit = 1440;    // 1 day = 1440 minutes
          else if (interval === '5m') actualLimit = 288; // 1 day = 288 * 5min
          else if (interval === '15m') actualLimit = 96; // 1 day = 96 * 15min
          else if (interval === '1h') actualLimit = 24;  // 1 day = 24 * 1hour
          else if (interval === '4h') actualLimit = 6;   // 1 day = 6 * 4hour
          else actualLimit = 30;
        } else if (period === 'weekly') {
          if (interval === '1h') actualLimit = 168;     // 1 week = 168 hours
          else if (interval === '4h') actualLimit = 42;  // 1 week = 42 * 4hour
          else if (interval === '1d') actualLimit = 7;   // 1 week = 7 days
          else actualLimit = 12;
        } else if (period === 'monthly') {
          if (interval === '1d') actualLimit = 30;      // 1 month = 30 days
          else if (interval === '1w') actualLimit = 4;   // 1 month = 4 weeks
          else actualLimit = 12;
        }
      }

      // Order by DESC to get latest data first, then reverse for chart display
      query += ' ORDER BY open_time DESC LIMIT {limit:UInt32}';
      params.limit = actualLimit;

      const result = await this.client.query({
        query,
        query_params: params,
        format: 'JSONEachRow'
      });

      return await result.json();
    } catch (error) {
      console.error('Error getting historical klines:', error);
      throw error;
    }
  }

  // Get historical trades
  async getHistoricalTrades(
    symbol: string,
    startTime?: string,
    endTime?: string,
    limit: number = 1000,
    offset: number = 0
  ): Promise<any[]> {
    try {
      let query = `
        SELECT 
          id,
          symbol,
          price,
          quantity,
          side,
          timestamp,
          trade_id,
          buyer_order_id,
          seller_order_id,
          created_at
        FROM trades 
        WHERE symbol = {symbol:String}
      `;

      const params: any = { symbol };

      if (startTime) {
        query += ' AND timestamp >= {startTime:DateTime64}';
        params.startTime = startTime;
      }

      if (endTime) {
        query += ' AND timestamp <= {endTime:DateTime64}';
        params.endTime = endTime;
      }

      query += ' ORDER BY timestamp DESC LIMIT {limit:UInt32} OFFSET {offset:UInt32}';
      params.limit = limit;
      params.offset = offset;

      const result = await this.client.query({
        query,
        query_params: params,
        format: 'JSONEachRow'
      });

      return await result.json();
    } catch (error) {
      console.error('Error getting historical trades:', error);
      throw error;
    }
  }

  // Get historical orders
  async getHistoricalOrders(
    userId: string,
    startTime?: string,
    endTime?: string,
    limit: number = 1000,
    offset: number = 0
  ): Promise<any[]> {
    try {
      let query = `
        SELECT 
          order_id,
          user_id,
          symbol,
          side,
          type,
          quantity,
          price,
          status,
          timestamp,
          filled_quantity,
          average_price,
          created_at
        FROM orders 
        WHERE user_id = {userId:String}
      `;

      const params: any = { userId };

      if (startTime) {
        query += ' AND timestamp >= {startTime:DateTime64}';
        params.startTime = startTime;
      }

      if (endTime) {
        query += ' AND timestamp <= {endTime:DateTime64}';
        params.endTime = endTime;
      }

      query += ' ORDER BY timestamp DESC LIMIT {limit:UInt32} OFFSET {offset:UInt32}';
      params.limit = limit;
      params.offset = offset;

      const result = await this.client.query({
        query,
        query_params: params,
        format: 'JSONEachRow'
      });

      return await result.json();
    } catch (error) {
      console.error('Error getting historical orders:', error);
      throw error;
    }
  }

  // Get performance metrics
  async getPerformanceMetrics(
    userId: string,
    startTime?: string,
    endTime?: string,
    period: string = 'daily'
  ): Promise<any[]> {
    try {
      let query = `
        SELECT 
          user_id,
          date,
          period,
          total_trades,
          winning_trades,
          losing_trades,
          win_rate,
          total_pnl,
          average_pnl,
          max_drawdown,
          sharpe_ratio,
          created_at
        FROM performance_metrics 
        WHERE user_id = {userId:String}
        AND period = {period:String}
      `;

      const params: any = { userId, period };

      if (startTime) {
        query += ' AND date >= {startTime:Date}';
        params.startTime = startTime;
      }

      if (endTime) {
        query += ' AND date <= {endTime:Date}';
        params.endTime = endTime;
      }

      query += ' ORDER BY date DESC';

      const result = await this.client.query({
        query,
        query_params: params,
        format: 'JSONEachRow'
      });

      return await result.json();
    } catch (error) {
      console.error('Error getting performance metrics:', error);
      throw error;
    }
  }

  // Get volume data
  async getVolumeData(
    symbol: string,
    startTime?: string,
    endTime?: string,
    period: string = '1h'
  ): Promise<any[]> {
    try {
      let query = `
        SELECT 
          symbol,
          period,
          timestamp,
          volume,
          trades_count,
          average_price,
          created_at
        FROM volume_data 
        WHERE symbol = {symbol:String}
        AND period = {period:String}
      `;

      const params: any = { symbol, period };

      if (startTime) {
        query += ' AND timestamp >= {startTime:DateTime64}';
        params.startTime = startTime;
      }

      if (endTime) {
        query += ' AND timestamp <= {endTime:DateTime64}';
        params.endTime = endTime;
      }

      query += ' ORDER BY timestamp DESC';

      const result = await this.client.query({
        query,
        query_params: params,
        format: 'JSONEachRow'
      });

      return await result.json();
    } catch (error) {
      console.error('Error getting volume data:', error);
      throw error;
    }
  }

  // Test connection
  async testConnection(): Promise<boolean> {
    try {
      await this.client.query({
        query: 'SELECT 1',
        format: 'JSONEachRow'
      });
      return true;
    } catch (error) {
      console.error('ClickHouse connection test failed:', error);
      return false;
    }
  }
}

export const clickhouseService = new ClickHouseService();
export default clickhouseService;
