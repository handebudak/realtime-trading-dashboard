import { getPostgresClient } from '../config/database';
import { logger } from '../utils/logger';
import { binanceService } from './binanceService';
import { broadcastTradeEvent } from './websocket';

export interface Order {
  id: number;
  user_id: number;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT' | 'STOP';
  quantity: number;
  price?: number;
  status: 'PENDING' | 'FILLED' | 'CANCELLED' | 'REJECTED';
  filled_quantity: number;
  average_price: number;
  created_at: Date;
  updated_at: Date;
}

export interface Position {
  id: number;
  user_id: number;
  symbol: string;
  side: 'LONG' | 'SHORT';
  quantity: number;
  entry_price: number;
  current_price?: number;
  unrealized_pnl: number;
  created_at: Date;
  updated_at: Date;
}

export interface Balance {
  id: number;
  user_id: number;
  asset: string;
  available: number;
  locked: number;
  total: number;
  created_at: Date;
  updated_at: Date;
}

export interface Trade {
  id: number;
  user_id: number;
  order_id: number;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  fee: number;
  created_at: Date;
}

export interface CreateOrderData {
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT' | 'STOP';
  quantity: number;
  price?: number | undefined;
  timeInForce?: 'GTC' | 'IOC' | 'FOK';
}

export interface OrderBookEntry {
  price: number;
  quantity: number;
}

export interface OrderBook {
  symbol: string;
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  timestamp: Date;
}

class TradingService {
  /**
   * Get user orders with pagination and filters
   */
  async getUserOrders(
    userId: number,
    filters: {
      status?: string;
      symbol?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ orders: Order[]; total: number }> {
    const client = await getPostgresClient();
    
    try {
      const { status, symbol, limit = 100, offset = 0 } = filters;
      
      let whereClause = 'WHERE user_id = $1';
      const queryParams: any[] = [userId];
      let paramIndex = 2;

      if (status) {
        whereClause += ` AND status = $${paramIndex}`;
        queryParams.push(status);
        paramIndex++;
      }

      if (symbol) {
        whereClause += ` AND symbol = $${paramIndex}`;
        queryParams.push(symbol);
        paramIndex++;
      }

      // Get total count
      const countQuery = `SELECT COUNT(*) as total FROM orders ${whereClause}`;
      const countResult = await client.query(countQuery, queryParams);
      const total = parseInt(countResult.rows[0].total);

      // Get orders with pagination
      const ordersQuery = `
        SELECT id, user_id, symbol, side, type, quantity, price, status, 
               filled_quantity, average_price, created_at, updated_at
        FROM orders 
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      
      queryParams.push(limit, offset);
      const ordersResult = await client.query(ordersQuery, queryParams);

      return {
        orders: ordersResult.rows as Order[],
        total
      };
    } finally {
      client.release();
    }
  }

  /**
   * Get specific order by ID
   */
  async getOrder(orderId: number, userId: number): Promise<Order | null> {
    const client = await getPostgresClient();
    
    try {
      const result = await client.query(
        'SELECT id, user_id, symbol, side, type, quantity, price, status, filled_quantity, average_price, created_at, updated_at FROM orders WHERE id = $1 AND user_id = $2',
        [orderId, userId]
      );

      return result.rows.length > 0 ? result.rows[0] as Order : null;
    } finally {
      client.release();
    }
  }

  /**
   * Create a new order
   */
  async createOrder(userId: number, orderData: CreateOrderData): Promise<Order> {
    const client = await getPostgresClient();
    
    try {
      await client.query('BEGIN');

      // DEBUG: Log incoming data
      console.log('🔍 DEBUG - Gelen data:', {
        quantity: orderData.quantity,
        price: orderData.price,
        quantityType: typeof orderData.quantity,
        priceType: typeof orderData.price
      });

      // Convert values to numbers (they come as strings from frontend)
      const quantity = typeof orderData.quantity === 'string' ? parseFloat(orderData.quantity) : orderData.quantity;
      const price = orderData.price ? (typeof orderData.price === 'string' ? parseFloat(orderData.price) : orderData.price) : undefined;

      // DEBUG: Log converted values
      console.log('🔍 DEBUG - Dönüştürülmüş değerler:', {
        quantity,
        price,
        quantityType: typeof quantity,
        priceType: typeof price,
        isQuantityNaN: isNaN(quantity),
        isPriceNaN: price ? isNaN(price) : 'undefined'
      });

      // Validate symbol exists and get current price
      const currentPrice = await this.getCurrentPrice(orderData.symbol);
      if (!currentPrice) {
        throw new Error(`Invalid symbol: ${orderData.symbol}`);
      }

      // For market orders, use current price
      const orderPrice = orderData.type === 'MARKET' ? currentPrice : price;
      if (!orderPrice) {
        throw new Error('Price is required for non-market orders');
      }

      // Check user balance for buy orders
      if (orderData.side === 'BUY') {
        const requiredAmount = quantity * orderPrice;
        const hasEnoughBalance = await this.checkUserBalance(userId, 'USDT', requiredAmount);
        if (!hasEnoughBalance) {
          throw new Error('Insufficient balance');
        }
      } else {
        // For sell orders, check if user has enough of the asset
        const baseAsset = orderData.symbol.replace('USDT', '');
        const hasEnoughBalance = await this.checkUserBalance(userId, baseAsset, quantity);
        if (!hasEnoughBalance) {
          throw new Error(`Insufficient ${baseAsset} balance`);
        }
      }

      // Create order
      // DEBUG: Log query parameters
      const queryParams = [userId, orderData.symbol, orderData.side, orderData.type, quantity, orderPrice, 'PENDING'];
      console.log('🔍 DEBUG - Query parametreleri:', {
        params: queryParams,
        quantityParam: queryParams[4],
        priceParam: queryParams[5],
        quantityParamType: typeof queryParams[4],
        priceParamType: typeof queryParams[5]
      });

      const result = await client.query(
        `INSERT INTO orders (user_id, symbol, side, type, quantity, price, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, user_id, symbol, side, type, quantity, price, status, 
                   filled_quantity, average_price, created_at, updated_at`,
        queryParams
      );

      const order = result.rows[0] as Order;

      // Lock balance
      await this.lockBalance(userId, orderData.side, orderData.symbol, quantity, orderPrice);

      // For market orders, execute immediately
      if (orderData.type === 'MARKET') {
        await this.executeMarketOrder(client, order);
      }

      await client.query('COMMIT');

      logger.info('Order created successfully', {
        orderId: order.id,
        userId,
        symbol: orderData.symbol,
        side: orderData.side,
        type: orderData.type,
        quantity: orderData.quantity
      });

      return order;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: number, userId: number): Promise<boolean> {
    const client = await getPostgresClient();
    
    try {
      await client.query('BEGIN');

      // Get order
      const orderResult = await client.query(
        'SELECT * FROM orders WHERE id = $1 AND user_id = $2 AND status = $3',
        [orderId, userId, 'PENDING']
      );

      if (orderResult.rows.length === 0) {
        throw new Error('Order not found or cannot be cancelled');
      }

      const order = orderResult.rows[0] as Order;

      // Update order status
      await client.query(
        'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2',
        ['CANCELLED', orderId]
      );

      // Unlock balance
      await this.unlockBalance(userId, order.side, order.symbol, order.quantity, order.price || 0);

      await client.query('COMMIT');

      logger.info('Order cancelled successfully', {
        orderId,
        userId,
        symbol: order.symbol
      });

      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get user positions
   */
  async getUserPositions(userId: number): Promise<Position[]> {
    const client = await getPostgresClient();
    
    try {
      const result = await client.query(
        'SELECT id, user_id, symbol, side, quantity, entry_price, current_price, unrealized_pnl, created_at, updated_at FROM positions WHERE user_id = $1',
        [userId]
      );

      return result.rows as Position[];
    } finally {
      client.release();
    }
  }

  /**
   * Get user balance
   */
  async getUserBalance(userId: number): Promise<Balance[]> {
    const client = await getPostgresClient();
    
    try {
      const result = await client.query(
        'SELECT id, user_id, asset, available, locked, total, created_at, updated_at FROM balances WHERE user_id = $1 AND (available > 0 OR locked > 0)',
        [userId]
      );

      return result.rows as Balance[];
    } finally {
      client.release();
    }
  }

  /**
   * Get user trades
   */
  async getUserTrades(
    userId: number,
    filters: {
      symbol?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ trades: Trade[]; total: number }> {
    const client = await getPostgresClient();
    
    try {
      const { symbol, limit = 100, offset = 0 } = filters;
      
      let whereClause = 'WHERE user_id = $1';
      const queryParams: any[] = [userId];
      let paramIndex = 2;

      if (symbol) {
        whereClause += ` AND symbol = $${paramIndex}`;
        queryParams.push(symbol);
        paramIndex++;
      }

      // Get total count
      const countQuery = `SELECT COUNT(*) as total FROM trades ${whereClause}`;
      const countResult = await client.query(countQuery, queryParams);
      const total = parseInt(countResult.rows[0].total);

      // Get trades with pagination
      const tradesQuery = `
        SELECT id, user_id, order_id, symbol, side, quantity, price, fee, created_at
        FROM trades 
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      
      queryParams.push(limit, offset);
      const tradesResult = await client.query(tradesQuery, queryParams);

      return {
        trades: tradesResult.rows as Trade[],
        total
      };
    } finally {
      client.release();
    }
  }

  /**
   * Get current price for a symbol
   */
  private async getCurrentPrice(symbol: string): Promise<number | null> {
    try {
      const ticker = await binanceService.get24hrTicker(symbol);
      return parseFloat((ticker as any).lastPrice);
    } catch (error) {
      logger.error('Failed to get current price', { symbol, error });
      return null;
    }
  }

  /**
   * Check if user has enough balance
   */
  private async checkUserBalance(userId: number, asset: string, requiredAmount: number): Promise<boolean> {
    const client = await getPostgresClient();
    
    try {
      const result = await client.query(
        'SELECT available FROM balances WHERE user_id = $1 AND asset = $2',
        [userId, asset]
      );

      if (result.rows.length === 0) {
        return false;
      }

      const available = parseFloat(result.rows[0].available);
      return available >= requiredAmount;
    } finally {
      client.release();
    }
  }

  /**
   * Lock balance for an order
   */
  private async lockBalance(userId: number, side: string, symbol: string, quantity: number, price: number): Promise<void> {
    const client = await getPostgresClient();
    
    try {
      if (side === 'BUY') {
        const amount = quantity * price;
        await client.query(
          'UPDATE balances SET available = available - $1, locked = locked + $1 WHERE user_id = $2 AND asset = $3',
          [amount, userId, 'USDT']
        );
      } else {
        const baseAsset = symbol.replace('USDT', '');
        await client.query(
          'UPDATE balances SET available = available - $1, locked = locked + $1 WHERE user_id = $2 AND asset = $3',
          [quantity, userId, baseAsset]
        );
      }
    } finally {
      client.release();
    }
  }

  /**
   * Unlock balance for a cancelled order
   */
  private async unlockBalance(userId: number, side: string, symbol: string, quantity: number, price: number): Promise<void> {
    const client = await getPostgresClient();
    
    try {
      if (side === 'BUY') {
        const amount = quantity * price;
        await client.query(
          'UPDATE balances SET available = available + $1, locked = locked - $1 WHERE user_id = $2 AND asset = $3',
          [amount, userId, 'USDT']
        );
      } else {
        const baseAsset = symbol.replace('USDT', '');
        await client.query(
          'UPDATE balances SET available = available + $1, locked = locked - $1 WHERE user_id = $2 AND asset = $3',
          [quantity, userId, baseAsset]
        );
      }
    } finally {
      client.release();
    }
  }

  /**
   * Execute a market order immediately
   */
  private async executeMarketOrder(client: any, order: Order): Promise<void> {
    try {
      // Get current market price
      const currentPrice = await this.getCurrentPrice(order.symbol);
      if (!currentPrice) {
        throw new Error('Unable to get current market price');
      }

      // Convert to numbers - order.quantity comes as string from database
      const quantity = typeof order.quantity === 'string' ? parseFloat(order.quantity) : order.quantity;
      
      // DEBUG: Log quantity conversion
      console.log('🔍 DEBUG - executeMarketOrder quantity:', {
        originalQuantity: order.quantity,
        originalType: typeof order.quantity,
        convertedQuantity: quantity,
        convertedType: typeof quantity,
        isNaN: isNaN(quantity)
      });

      // Update order as filled
      await client.query(
        'UPDATE orders SET status = $1, filled_quantity = $2, average_price = $3, updated_at = NOW() WHERE id = $4',
        ['FILLED', quantity, currentPrice, order.id]
      );

      // Update balances
      if (order.side === 'BUY') {
        const baseAsset = order.symbol.replace('USDT', '');
        const cost = quantity * currentPrice;
        
        // Remove USDT from locked
        await client.query(
          'UPDATE balances SET locked = locked - $1 WHERE user_id = $2 AND asset = $3',
          [cost, order.user_id, 'USDT']
        );

        // Add base asset to available
        await client.query(
          `INSERT INTO balances (user_id, asset, available, locked) 
           VALUES ($1, $2, $3, 0)
           ON CONFLICT (user_id, asset) 
           DO UPDATE SET available = balances.available + $3`,
          [order.user_id, baseAsset, quantity]
        );
      } else {
        const baseAsset = order.symbol.replace('USDT', '');
        const proceeds = quantity * currentPrice;
        
        // Remove base asset from locked
        await client.query(
          'UPDATE balances SET locked = locked - $1 WHERE user_id = $2 AND asset = $3',
          [quantity, order.user_id, baseAsset]
        );

        // Add USDT to available
        await client.query(
          `INSERT INTO balances (user_id, asset, available, locked) 
           VALUES ($1, $2, $3, 0)
           ON CONFLICT (user_id, asset) 
           DO UPDATE SET available = balances.available + $3`,
          [order.user_id, 'USDT', proceeds]
        );
      }

      // Create trade record
      const tradeResult = await client.query(
        `INSERT INTO trades (user_id, order_id, symbol, side, quantity, price, fee) 
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, user_id, order_id, symbol, side, quantity, price, fee, created_at`,
        [order.user_id, order.id, order.symbol, order.side, order.quantity, currentPrice, 0] // No fee for demo
      );

      const trade = tradeResult.rows[0];

      // Broadcast trade event via WebSocket
      broadcastTradeEvent(order.user_id, {
        id: trade.id,
        symbol: trade.symbol,
        side: trade.side,
        quantity: trade.quantity,
        price: trade.price,
        timestamp: trade.created_at
      });

      // Update or create position
      // Update position - pass converted quantity, not original order.quantity
      await this.updatePosition(client, order.user_id, order.symbol, order.side, quantity, currentPrice);

      logger.info('Market order executed', {
        orderId: order.id,
        symbol: order.symbol,
        side: order.side,
        quantity: order.quantity,
        price: currentPrice
      });
    } catch (error) {
      logger.error('Failed to execute market order', { orderId: order.id, error });
      throw error;
    }
  }

  /**
   * Update user position after trade
   */
  private async updatePosition(client: any, userId: number, symbol: string, side: string, quantity: number, price: number): Promise<void> {
    const positionSide = side === 'BUY' ? 'LONG' : 'SHORT';
    
    try {
      // Check if position exists
      const existingPosition = await client.query(
        'SELECT * FROM positions WHERE user_id = $1 AND symbol = $2 AND side = $3',
        [userId, symbol, positionSide]
      );

      // DEBUG: Log database result
      console.log('🔍 DEBUG - DB Position Result:', {
        rowsLength: existingPosition.rows.length,
        position: existingPosition.rows[0] ? {
          quantity: existingPosition.rows[0].quantity,
          quantityType: typeof existingPosition.rows[0].quantity,
          entry_price: existingPosition.rows[0].entry_price,
          entry_priceType: typeof existingPosition.rows[0].entry_price
        } : 'No position found'
      });

      if (existingPosition.rows.length > 0) {
        // Update existing position
        const position = existingPosition.rows[0];
        // Convert position.quantity to number to avoid string concatenation
        const existingQuantity = typeof position.quantity === 'string' ? parseFloat(position.quantity) : position.quantity;
        
        // DEBUG: Log calculation steps
        console.log('🔍 DEBUG - Quantity Calculation:', {
          positionQuantity: position.quantity,
          positionQuantityType: typeof position.quantity,
          existingQuantity,
          existingQuantityType: typeof existingQuantity,
          inputQuantity: quantity,
          inputQuantityType: typeof quantity,
          side
        });
        
        const newQuantity = side === 'BUY' ? existingQuantity + quantity : existingQuantity - quantity;
        
        // DEBUG: Log final result
        console.log('🔍 DEBUG - New Quantity Result:', {
          newQuantity,
          newQuantityType: typeof newQuantity,
          isNaN: isNaN(newQuantity)
        });
        
        if (newQuantity <= 0) {
          // Close position
          await client.query(
            'DELETE FROM positions WHERE user_id = $1 AND symbol = $2 AND side = $3',
            [userId, symbol, positionSide]
          );
        } else {
          // Update position
          const existingEntryPrice = typeof position.entry_price === 'string' ? parseFloat(position.entry_price) : position.entry_price;
          const newEntryPrice = (existingEntryPrice * existingQuantity + price * quantity) / newQuantity;
          // DEBUG: Log UPDATE query parameters
          const updateParams = [newQuantity, newEntryPrice, userId, symbol, positionSide];
          console.log('🔍 DEBUG - UPDATE Query Params:', {
            params: updateParams,
            newQuantity: updateParams[0],
            newQuantityType: typeof updateParams[0],
            newEntryPrice: updateParams[1],
            newEntryPriceType: typeof updateParams[1]
          });

          await client.query(
            'UPDATE positions SET quantity = $1, entry_price = $2, updated_at = NOW() WHERE user_id = $3 AND symbol = $4 AND side = $5',
            updateParams
          );
        }
      } else {
        // Create new position
        // DEBUG: Log INSERT query parameters
        const insertParams = [userId, symbol, positionSide, quantity, price, price];
        console.log('🔍 DEBUG - INSERT Query Params:', {
          params: insertParams,
          quantity: insertParams[3],
          quantityType: typeof insertParams[3],
          price: insertParams[4],
          priceType: typeof insertParams[4]
        });

        await client.query(
          'INSERT INTO positions (user_id, symbol, side, quantity, entry_price, current_price, unrealized_pnl) VALUES ($1, $2, $3, $4, $5, $6, 0)',
          insertParams
        );
      }
    } catch (error) {
      logger.error('Failed to update position', { userId, symbol, side, quantity, price, error });
      throw error;
    }
  }
}

export const tradingService = new TradingService();
export default tradingService;
