import { Router, Request, Response } from 'express';
import { authRateLimiter } from '../middleware/rateLimiter';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticateToken } from '../middleware/auth';
import { authService } from '../services/authService';
import { registerSchema, loginSchema, refreshTokenSchema } from '../utils/authValidation';
import { validate } from '../utils/validation';

const router = Router();

// Apply rate limiting to auth routes
router.use(authRateLimiter);

// POST /api/v1/auth/register
router.post('/register', 
  validate(registerSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { username, email, password } = req.body;

    try {
      const result = await authService.register({ username, email, password });
      
      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          user: {
            id: result.user.id,
            username: result.user.username,
            email: result.user.email,
            role: result.user.role,
            is_active: result.user.is_active,
            created_at: result.user.created_at
          },
          tokens: result.tokens
        }
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  })
);

// POST /api/v1/auth/login
router.post('/login',
  validate(loginSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent');

    try {
      // Check login attempts
      const canLogin = await authService.checkLoginAttempts(email, ipAddress);
      if (!canLogin) {
        res.status(429).json({
          success: false,
          message: 'Too many failed login attempts. Please try again later.'
        });
        return;
      }

      const result = await authService.login({ email, password }, ipAddress, userAgent);
      
      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: result.user.id,
            username: result.user.username,
            email: result.user.email,
            role: result.user.role,
            is_active: result.user.is_active
          },
          tokens: result.tokens
        }
      });
    } catch (error: any) {
      res.status(401).json({
        success: false,
        message: error.message
      });
    }
  })
);

// POST /api/v1/auth/refresh
router.post('/refresh',
  validate(refreshTokenSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = req.body;

    try {
      const tokens = await authService.refreshToken(refreshToken);
      
      res.status(200).json({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          tokens
        }
      });
    } catch (error: any) {
      res.status(401).json({
        success: false,
        message: error.message
      });
    }
  })
);

// POST /api/v1/auth/logout
router.post('/logout',
  asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = req.body;

    if (refreshToken) {
      try {
        await authService.logout(refreshToken);
      } catch (error) {
        // Continue even if logout fails
      }
    }

    res.status(200).json({
      success: true,
      message: 'Logout successful'
    });
  })
);

// GET /api/v1/auth/me
router.get('/me',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const user = await authService.getCurrentUser(req.user!.userId);
      
      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'User data retrieved successfully',
        data: {
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            is_active: user.is_active,
            created_at: user.created_at,
            updated_at: user.updated_at
          }
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve user data'
      });
    }
  })
);

export { router as authRoutes };
