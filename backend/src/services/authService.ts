import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { getPostgresClient } from '../config/database';
import { config } from '../config/environment';
import { logger } from '../utils/logger';

export interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface LoginAttempt {
  user_id?: number;
  ip_address: string;
  user_agent?: string | undefined;
  success: boolean;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

class AuthService {
  private readonly saltRounds = 12;
  private readonly accessTokenExpiry = '24h';
  // private readonly refreshTokenExpiry = '7d'; // Not used currently

  /**
   * Hash a password using bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, this.saltRounds);
  }

  /**
   * Verify a password against its hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
  }

  /**
   * Generate JWT access token
   */
  generateAccessToken(user: User): string {
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      type: 'access'
    };

    return jwt.sign(payload, config.JWT_SECRET, {
      expiresIn: this.accessTokenExpiry,
      issuer: 'trading-dashboard',
      audience: 'trading-dashboard-users'
    });
  }

  /**
   * Generate refresh token
   */
  generateRefreshToken(): string {
    return uuidv4();
  }

  /**
   * Verify JWT access token
   */
  verifyAccessToken(token: string): any {
    try {
      return jwt.verify(token, config.JWT_SECRET, {
        issuer: 'trading-dashboard',
        audience: 'trading-dashboard-users'
      });
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Register a new user
   */
  async register(data: RegisterData): Promise<{ user: User; tokens: AuthTokens }> {
    const client = await getPostgresClient();
    
    try {
      // Check if user already exists
      const existingUser = await client.query(
        'SELECT id FROM users WHERE email = $1 OR username = $2',
        [data.email, data.username]
      );

      if (existingUser.rows.length > 0) {
        throw new Error('User with this email or username already exists');
      }

      // Hash password
      const hashedPassword = await this.hashPassword(data.password);

      // Create user
      const result = await client.query(
        `INSERT INTO users (username, email, password_hash, role, is_active)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, username, email, role, is_active, created_at, updated_at`,
        [data.username, data.email, hashedPassword, 'trader', true]
      );

      const user = result.rows[0] as User;

      // Generate tokens
      const accessToken = this.generateAccessToken(user);
      const refreshToken = this.generateRefreshToken();

      // Store refresh token
      await this.storeRefreshToken(user.id, refreshToken);

      // Create default balance for user
      await client.query(
        'INSERT INTO balances (user_id, asset, available) VALUES ($1, $2, $3)',
        [user.id, 'USDT', 10000.00] // Demo balance
      );

      logger.info('User registered successfully', {
        userId: user.id,
        email: user.email,
        username: user.username
      });

      return {
        user,
        tokens: {
          accessToken,
          refreshToken
        }
      };

    } finally {
      client.release();
    }
  }

  /**
   * Login user
   */
  async login(data: LoginData, ipAddress: string, userAgent?: string): Promise<{ user: User; tokens: AuthTokens }> {
    const client = await getPostgresClient();
    
    try {
      // Find user by email
      const result = await client.query(
        'SELECT id, username, email, password_hash, role, is_active, created_at, updated_at FROM users WHERE email = $1',
        [data.email]
      );

      if (result.rows.length === 0) {
        // Log failed attempt
        await this.logLoginAttempt({ ip_address: ipAddress, user_agent: userAgent, success: false });
        throw new Error('Invalid email or password');
      }

      const user = result.rows[0] as User & { password_hash: string };

      // Check if user is active
      if (!user.is_active) {
        await this.logLoginAttempt({ user_id: user.id, ip_address: ipAddress, user_agent: userAgent, success: false });
        throw new Error('Account is deactivated');
      }

      // Verify password
      const isValidPassword = await this.verifyPassword(data.password, user.password_hash);
      
      if (!isValidPassword) {
        await this.logLoginAttempt({ user_id: user.id, ip_address: ipAddress, user_agent: userAgent, success: false });
        throw new Error('Invalid email or password');
      }

      // Log successful attempt
      await this.logLoginAttempt({ user_id: user.id, ip_address: ipAddress, user_agent: userAgent, success: true });

      // Generate tokens
      const accessToken = this.generateAccessToken(user);
      const refreshToken = this.generateRefreshToken();

      // Store refresh token
      await this.storeRefreshToken(user.id, refreshToken);

      // Remove password_hash from user object
      const { password_hash, ...userWithoutPassword } = user;

      logger.info('User logged in successfully', {
        userId: user.id,
        email: user.email,
        ipAddress
      });

      return {
        user: userWithoutPassword,
        tokens: {
          accessToken,
          refreshToken
        }
      };

    } finally {
      client.release();
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const client = await getPostgresClient();
    
    try {
      // Find refresh token
      const result = await client.query(
        `SELECT rt.user_id, rt.expires_at, rt.is_revoked, u.id, u.username, u.email, u.role, u.is_active, u.created_at, u.updated_at
         FROM refresh_tokens rt
         JOIN users u ON rt.user_id = u.id
         WHERE rt.token = $1 AND rt.is_revoked = false`,
        [refreshToken]
      );

      if (result.rows.length === 0) {
        throw new Error('Invalid refresh token');
      }

      const tokenData = result.rows[0];
      const user = {
        id: tokenData.user_id,
        username: tokenData.username,
        email: tokenData.email,
        role: tokenData.role,
        is_active: tokenData.is_active,
        created_at: tokenData.created_at,
        updated_at: tokenData.updated_at
      } as User;

      // Check if token is expired
      if (new Date() > new Date(tokenData.expires_at)) {
        // Revoke expired token
        await client.query('UPDATE refresh_tokens SET is_revoked = true WHERE token = $1', [refreshToken]);
        throw new Error('Refresh token expired');
      }

      // Check if user is still active
      if (!user.is_active) {
        throw new Error('User account is deactivated');
      }

      // Generate new tokens
      const newAccessToken = this.generateAccessToken(user);
      const newRefreshToken = this.generateRefreshToken();

      // Revoke old refresh token
      await client.query('UPDATE refresh_tokens SET is_revoked = true WHERE token = $1', [refreshToken]);

      // Store new refresh token
      await this.storeRefreshToken(user.id, newRefreshToken);

      logger.info('Token refreshed successfully', {
        userId: user.id,
        email: user.email
      });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken
      };

    } finally {
      client.release();
    }
  }

  /**
   * Logout user (revoke refresh token)
   */
  async logout(refreshToken: string): Promise<void> {
    const client = await getPostgresClient();
    
    try {
      await client.query('UPDATE refresh_tokens SET is_revoked = true WHERE token = $1', [refreshToken]);
      
      logger.info('User logged out successfully', {
        refreshToken: refreshToken.substring(0, 8) + '...'
      });
    } finally {
      client.release();
    }
  }

  /**
   * Get current user by ID
   */
  async getCurrentUser(userId: number): Promise<User | null> {
    const client = await getPostgresClient();
    
    try {
      const result = await client.query(
        'SELECT id, username, email, role, is_active, created_at, updated_at FROM users WHERE id = $1',
        [userId]
      );

      return result.rows.length > 0 ? result.rows[0] as User : null;
    } finally {
      client.release();
    }
  }

  /**
   * Store refresh token in database
   */
  private async storeRefreshToken(userId: number, refreshToken: string): Promise<void> {
    const client = await getPostgresClient();
    
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

      await client.query(
        'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
        [userId, refreshToken, expiresAt]
      );
    } finally {
      client.release();
    }
  }

  /**
   * Log login attempt
   */
  private async logLoginAttempt(attempt: LoginAttempt): Promise<void> {
    const client = await getPostgresClient();
    
    try {
      await client.query(
        'INSERT INTO login_attempts (user_id, ip_address, user_agent, success) VALUES ($1, $2, $3, $4)',
        [attempt.user_id || null, attempt.ip_address, attempt.user_agent || null, attempt.success]
      );
    } finally {
      client.release();
    }
  }

  /**
   * Check if user has too many failed login attempts
   */
  async checkLoginAttempts(email: string, ipAddress: string): Promise<boolean> {
    const client = await getPostgresClient();
    
    try {
      // Check failed attempts in last 15 minutes
      const result = await client.query(
        `SELECT COUNT(*) as count
         FROM login_attempts la
         JOIN users u ON la.user_id = u.id
         WHERE (u.email = $1 OR la.ip_address = $2)
         AND la.success = false
         AND la.attempted_at > NOW() - INTERVAL '15 minutes'`,
        [email, ipAddress]
      );

      const failedAttempts = parseInt(result.rows[0].count);
      return failedAttempts < 5; // Allow max 5 failed attempts
    } finally {
      client.release();
    }
  }
}

export const authService = new AuthService();
export default authService;
