import { Router, Request, Response } from 'express';
import { tradingRateLimiter } from '../middleware/rateLimiter';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticateToken, requireTrader } from '../middleware/auth';
import { tradingService } from '../services/tradingService';
import { validate, validateQuery, validateParams } from '../utils/validation';
import { tradingSchemas } from '../utils/validation';

const router = Router();

// Apply rate limiting and authentication to trading routes
router.use(tradingRateLimiter);
router.use(authenticateToken);
router.use(requireTrader);

// GET /api/v1/trading/orders
router.get('/orders',
  validateQuery(tradingSchemas.getOrders),
  asyncHandler(async (req: Request, res: Response) => {
    const { status, symbol, limit = 100, offset = 0 } = req.query;
    const userId = req.user!.userId;

    try {
      const result = await tradingService.getUserOrders(userId, {
        status: status as string,
        symbol: symbol as string,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      });

      res.status(200).json({
        success: true,
        message: 'User orders retrieved successfully',
        data: {
          orders: result.orders,
          pagination: {
            total: result.total,
            limit: parseInt(limit as string),
            offset: parseInt(offset as string)
          }
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve orders',
        error: error.message
      });
    }
  })
);

// POST /api/v1/trading/orders
router.post('/orders',
  validate(tradingSchemas.createOrder),
  asyncHandler(async (req: Request, res: Response) => {
    const { symbol, side, type, quantity, price, timeInForce } = req.body;
    const userId = req.user!.userId;

    try {
      const order = await tradingService.createOrder(userId, {
        symbol,
        side: side.toUpperCase(),
        type: type.toUpperCase(),
        quantity: parseFloat(quantity),
        price: price ? parseFloat(price) : undefined,
        timeInForce
      });

      res.status(201).json({
        success: true,
        message: 'Order created successfully',
        data: {
          order
        }
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: 'Failed to create order',
        error: error.message
      });
    }
  })
);

// GET /api/v1/trading/orders/:orderId
router.get('/orders/:orderId',
  validateParams(tradingSchemas.getOrder),
  asyncHandler(async (req: Request, res: Response) => {
    const { orderId } = req.params;
    const userId = req.user!.userId;

    try {
      const order = await tradingService.getOrder(parseInt(orderId!), userId);
      
      if (!order) {
        res.status(404).json({
          success: false,
          message: 'Order not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Order retrieved successfully',
        data: {
          order
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve order',
        error: error.message
      });
    }
  })
);

// DELETE /api/v1/trading/orders/:orderId
router.delete('/orders/:orderId',
  validateParams(tradingSchemas.cancelOrder),
  asyncHandler(async (req: Request, res: Response) => {
    const { orderId } = req.params;
    const userId = req.user!.userId;

    try {
      const success = await tradingService.cancelOrder(parseInt(orderId!), userId);
      
      if (!success) {
        res.status(404).json({
          success: false,
          message: 'Order not found or cannot be cancelled'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Order cancelled successfully',
        data: {
          orderId: parseInt(orderId!),
          status: 'cancelled',
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: 'Failed to cancel order',
        error: error.message
      });
    }
  })
);

// GET /api/v1/trading/positions
router.get('/positions', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;

  try {
    const positions = await tradingService.getUserPositions(userId);

    res.status(200).json({
      success: true,
      message: 'User positions retrieved successfully',
      data: {
        positions
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve positions',
      error: error.message
    });
  }
}));

// GET /api/v1/trading/balance
router.get('/balance', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;

  try {
    const balances = await tradingService.getUserBalance(userId);

    // Calculate totals
    const totalUSDT = balances.reduce((sum, balance) => {
      if (balance.asset === 'USDT') {
        return sum + balance.total;
      }
      return sum;
    }, 0);

    const availableUSDT = balances.reduce((sum, balance) => {
      if (balance.asset === 'USDT') {
        return sum + balance.available;
      }
      return sum;
    }, 0);

    const lockedUSDT = balances.reduce((sum, balance) => {
      if (balance.asset === 'USDT') {
        return sum + balance.locked;
      }
      return sum;
    }, 0);

    res.status(200).json({
      success: true,
      message: 'User balance retrieved successfully',
      data: {
        balance: {
          total: totalUSDT.toFixed(2),
          available: availableUSDT.toFixed(2),
          locked: lockedUSDT.toFixed(2),
          currencies: balances.map(balance => ({
            currency: balance.asset,
            balance: balance.total.toFixed(8),
            available: balance.available.toFixed(8),
            locked: balance.locked.toFixed(8)
          }))
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve balance',
      error: error.message
    });
  }
}));

// GET /api/v1/trading/trades
router.get('/trades',
  validateQuery(tradingSchemas.getTrades),
  asyncHandler(async (req: Request, res: Response) => {
    const { symbol, limit = 100, offset = 0 } = req.query;
    const userId = req.user!.userId;

    try {
      const result = await tradingService.getUserTrades(userId, {
        symbol: symbol as string,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      });

      res.status(200).json({
        success: true,
        message: 'User trades retrieved successfully',
        data: {
          trades: result.trades,
          pagination: {
            total: result.total,
            limit: parseInt(limit as string),
            offset: parseInt(offset as string)
          }
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve trades',
        error: error.message
      });
    }
  })
);

export { router as tradingRoutes };
