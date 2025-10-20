import { User, AuthTokens, LoginData, RegisterData } from '@/contexts/AuthContext'

const API_BASE_URL = 'http://localhost:3002/api/v1'

class AuthService {
  private getAuthHeaders(): HeadersInit {
    const tokens = this.getStoredTokens()
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }

    if (tokens?.accessToken) {
      headers['Authorization'] = `Bearer ${tokens.accessToken}`
    }

    return headers
  }

  private getStoredTokens(): AuthTokens | null {
    try {
      const stored = localStorage.getItem('auth_tokens')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  }

  private setStoredTokens(tokens: AuthTokens): void {
    localStorage.setItem('auth_tokens', JSON.stringify(tokens))
  }

  private clearStoredTokens(): void {
    localStorage.removeItem('auth_tokens')
  }

  async login(data: LoginData): Promise<{ user: User; tokens: AuthTokens }> {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.message || 'Login failed')
    }

    return result.data
  }

  async register(data: RegisterData): Promise<{ user: User; tokens: AuthTokens }> {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.message || 'Registration failed')
    }

    return result.data
  }

  async getCurrentUser(): Promise<User> {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: this.getAuthHeaders(),
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.message || 'Failed to get user data')
    }

    return result.data.user
  }

  async refreshToken(): Promise<AuthTokens> {
    const tokens = this.getStoredTokens()
    
    if (!tokens?.refreshToken) {
      throw new Error('No refresh token available')
    }

    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.message || 'Token refresh failed')
    }

    return result.data.tokens
  }

  async logout(): Promise<void> {
    const tokens = this.getStoredTokens()
    
    if (tokens?.refreshToken) {
      try {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refreshToken: tokens.refreshToken }),
        })
      } catch (error) {
        console.error('Logout request failed:', error)
      }
    }

    this.clearStoredTokens()
  }

  // Utility methods for token management
  getAccessToken(): string | null {
    return this.getStoredTokens()?.accessToken || null
  }

  getRefreshToken(): string | null {
    return this.getStoredTokens()?.refreshToken || null
  }

  isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      const currentTime = Date.now() / 1000
      return payload.exp < currentTime
    } catch {
      return true
    }
  }

  // API request helper with automatic token refresh
  async apiRequest(url: string, options: RequestInit = {}): Promise<Response> {
    const tokens = this.getStoredTokens()
    
    if (!tokens?.accessToken) {
      throw new Error('No access token available')
    }

    // Check if token is expired
    if (this.isTokenExpired(tokens.accessToken)) {
      try {
        const newTokens = await this.refreshToken()
        this.setStoredTokens(newTokens)
      } catch (error) {
        this.clearStoredTokens()
        throw new Error('Token refresh failed')
      }
    }

    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${this.getAccessToken()}`,
      'Content-Type': 'application/json',
    }

    const response = await fetch(url, {
      ...options,
      headers,
    })

    // If still unauthorized, clear tokens
    if (response.status === 401) {
      this.clearStoredTokens()
      throw new Error('Unauthorized')
    }

    return response
  }
}

export const authService = new AuthService()
export default authService
