import Joi from 'joi';

// Common validation schemas
export const commonSchemas = {
  id: Joi.string().uuid().required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(128).required(),
  symbol: Joi.string().pattern(/^[A-Z]{3,10}[A-Z]{3,10}$/).required(),
  quantity: Joi.string().pattern(/^\d+(\.\d+)?$/).required(),
  price: Joi.string().pattern(/^\d+(\.\d+)?$/).required(),
  timestamp: Joi.date().iso().required(),
  pagination: {
    limit: Joi.number().integer().min(1).max(1000).default(100),
    offset: Joi.number().integer().min(0).default(0),
  },
};

// Authentication validation schemas
export const authSchemas = {
  login: Joi.object({
    email: commonSchemas.email,
    password: commonSchemas.password,
  }),
  
  register: Joi.object({
    email: commonSchemas.email,
    password: commonSchemas.password,
    confirmPassword: Joi.string().valid(Joi.ref('password')).required(),
    role: Joi.string().valid('trader', 'viewer').default('trader'),
  }),
  
  refreshToken: Joi.object({
    refreshToken: Joi.string().required(),
  }),
};

// Market data validation schemas
export const marketDataSchemas = {
  getTicker: Joi.object({
    symbol: commonSchemas.symbol,
  }),
  
  getOrderBook: Joi.object({
    symbol: commonSchemas.symbol,
    limit: Joi.number().integer().min(1).max(5000).default(100),
  }),
  
  getTrades: Joi.object({
    symbol: commonSchemas.symbol,
    limit: commonSchemas.pagination.limit,
  }),
  
  getKlines: Joi.object({
    symbol: commonSchemas.symbol,
    interval: Joi.string().valid('1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M').default('1h'),
    limit: commonSchemas.pagination.limit,
  }),
};

// Trading validation schemas
export const tradingSchemas = {
  createOrder: Joi.object({
    symbol: commonSchemas.symbol,
    side: Joi.string().valid('buy', 'sell').required(),
    type: Joi.string().valid('market', 'limit', 'stop', 'stop_limit').required(),
    quantity: commonSchemas.quantity,
    price: Joi.when('type', {
      is: Joi.string().valid('limit', 'stop_limit'),
      then: commonSchemas.price.required(),
      otherwise: Joi.string().pattern(/^\d+(\.\d+)?$/).optional(),
    }),
    stopPrice: Joi.when('type', {
      is: Joi.string().valid('stop', 'stop_limit'),
      then: commonSchemas.price.required(),
      otherwise: Joi.string().pattern(/^\d+(\.\d+)?$/).optional(),
    }),
    timeInForce: Joi.string().valid('GTC', 'IOC', 'FOK').default('GTC'),
  }),
  
  getOrders: Joi.object({
    status: Joi.string().valid('pending', 'filled', 'cancelled', 'rejected').optional(),
    symbol: commonSchemas.symbol.optional(),
    limit: commonSchemas.pagination.limit,
    offset: commonSchemas.pagination.offset,
  }),
  
  getOrder: Joi.object({
    orderId: commonSchemas.id,
  }),
  
  cancelOrder: Joi.object({
    orderId: commonSchemas.id,
  }),
  
  getTrades: Joi.object({
    symbol: commonSchemas.symbol.optional(),
    limit: commonSchemas.pagination.limit,
    offset: commonSchemas.pagination.offset,
  }),
};

// Historical data validation schemas
export const historicalDataSchemas = {
  getKlines: Joi.object({
    symbol: commonSchemas.symbol,
    interval: Joi.string().valid('1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M').default('1h'),
    startTime: Joi.date().iso().optional(),
    endTime: Joi.date().iso().optional(),
    limit: commonSchemas.pagination.limit,
  }),
  
  getTrades: Joi.object({
    symbol: commonSchemas.symbol,
    startTime: Joi.date().iso().optional(),
    endTime: Joi.date().iso().optional(),
    limit: commonSchemas.pagination.limit,
    offset: commonSchemas.pagination.offset,
  }),
  
  getOrders: Joi.object({
    userId: commonSchemas.id,
    startTime: Joi.date().iso().optional(),
    endTime: Joi.date().iso().optional(),
    limit: commonSchemas.pagination.limit,
    offset: commonSchemas.pagination.offset,
  }),
  
  getPerformance: Joi.object({
    userId: commonSchemas.id,
    startTime: Joi.date().iso().optional(),
    endTime: Joi.date().iso().optional(),
    period: Joi.string().valid('hourly', 'daily', 'weekly', 'monthly').default('daily'),
  }),
  
  getVolume: Joi.object({
    symbol: commonSchemas.symbol,
    startTime: Joi.date().iso().optional(),
    endTime: Joi.date().iso().optional(),
    period: Joi.string().valid('1m', '5m', '15m', '30m', '1h', '4h', '1d').default('1h'),
  }),
};

// System validation schemas
export const systemSchemas = {
  getLogs: Joi.object({
    level: Joi.string().valid('error', 'warn', 'info', 'debug').optional(),
    limit: commonSchemas.pagination.limit,
    offset: commonSchemas.pagination.offset,
  }),
  
  acknowledgeAlert: Joi.object({
    alertId: commonSchemas.id,
  }),
};

// WebSocket validation schemas
export const websocketSchemas = {
  subscribeMarketData: Joi.object({
    symbols: Joi.array().items(commonSchemas.symbol).min(1).max(50).required(),
  }),
  
  unsubscribeMarketData: Joi.object({
    symbols: Joi.array().items(commonSchemas.symbol).min(1).max(50).required(),
  }),
};

// Validation middleware factory
export const validate = (schema: Joi.ObjectSchema) => {
  return (req: any, res: any, next: any) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false });
    
    if (error) {
      const errorDetails = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));
      
      return res.status(400).json({
        success: false,
        error: {
          message: 'Validation error',
          details: errorDetails,
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    req.body = value;
    next();
  };
};

// Query validation middleware factory
export const validateQuery = (schema: Joi.ObjectSchema) => {
  return (req: any, res: any, next: any) => {
    const { error, value } = schema.validate(req.query, { abortEarly: false });
    
    if (error) {
      const errorDetails = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));
      
      return res.status(400).json({
        success: false,
        error: {
          message: 'Query validation error',
          details: errorDetails,
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    Object.assign(req.query, value);
    next();
  };
};

// Params validation middleware factory
export const validateParams = (schema: Joi.ObjectSchema) => {
  return (req: any, res: any, next: any) => {
    const { error, value } = schema.validate(req.params, { abortEarly: false });
    
    if (error) {
      const errorDetails = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));
      
      return res.status(400).json({
        success: false,
        error: {
          message: 'Parameter validation error',
          details: errorDetails,
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    req.params = value;
    next();
  };
};

