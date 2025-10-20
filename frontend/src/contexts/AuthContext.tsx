'use client'

import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react'
import { api } from '@/services/apiClient'

export interface User {
  id: number
  username: string
  email: string
  role: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export interface LoginData {
  email: string
  password: string
}

export interface RegisterData {
  username: string
  email: string
  password: string
}

interface AuthContextType {
  user: User | null
  tokens: AuthTokens | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (data: LoginData) => Promise<void>
  register: (data: RegisterData) => Promise<void>
  logout: () => void
  refreshToken: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [tokens, setTokens] = useState<AuthTokens | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const isAuthenticated = !!user && !!tokens

  // Debug: State değişikliklerini izle
  useEffect(() => {
    console.log('🔐 AuthContext: State changed:', { 
      isAuthenticated, 
      hasUser: !!user, 
      hasTokens: !!tokens,
      user: user?.username,
      tokenExists: !!tokens?.accessToken
    })
  }, [isAuthenticated, user, tokens])

  // Initialize auth state from localStorage
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedTokens = localStorage.getItem('auth_tokens')
        if (storedTokens) {
          const parsedTokens = JSON.parse(storedTokens)
          setTokens(parsedTokens)
          
          // Verify token and get user data
          const userData = await fetchUserData(parsedTokens.accessToken)
          if (userData) {
            setUser(userData)
          } else {
            // Token is invalid, try to refresh
            await refreshToken()
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error)
        // Clear invalid tokens
        localStorage.removeItem('auth_tokens')
        setTokens(null)
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }

    initializeAuth()
  }, [])

  // Auto refresh token before expiry
  useEffect(() => {
    if (!tokens) return

    const refreshInterval = setInterval(async () => {
      try {
        await refreshToken()
      } catch (error) {
        console.error('Auto refresh failed:', error)
        logout()
      }
    }, 14 * 60 * 1000) // Refresh every 14 minutes (token expires in 15)

    return () => clearInterval(refreshInterval)
  }, [tokens])

  const fetchUserData = async (accessToken: string): Promise<User | null> => {
    try {
      const data = await api.get<any>('/api/v1/auth/me', { headers: { 'Authorization': `Bearer ${accessToken}` } })
      return data.data.user
    } catch (error) {
      console.error('Failed to fetch user data:', error)
      return null
    }
  }

  const login = async (data: LoginData): Promise<void> => {
    try {
      console.log('🔐 AuthContext: Login started with data:', data)
      setIsLoading(true)
      
      const result = await api.post<any>('/api/v1/auth/login', data)
      console.log('🔐 AuthContext: API response:', result)

      const { user: userData, tokens: authTokens } = result.data
      console.log('🔐 AuthContext: Setting state with:', { userData, authTokens })
      
      setUser(userData)
      setTokens(authTokens)
      localStorage.setItem('auth_tokens', JSON.stringify(authTokens))
      
      console.log('🔐 AuthContext: State updated, user and tokens set')
      
      // Redirect to dashboard after successful login
      if (typeof window !== 'undefined') {
        window.location.href = '/'
      }
      
    } catch (error) {
      console.error('🔐 AuthContext: Login error:', error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const register = async (data: RegisterData): Promise<void> => {
    try {
      console.log('🔐 AuthContext: Registration started with data:', {
        username: data.username,
        email: data.email,
        passwordLength: data.password.length
      })
      
      setIsLoading(true)
      
      const result = await api.post<any>('/api/v1/auth/register', data)
      console.log('🔐 AuthContext: Registration API response:', {
        success: result.success,
        message: result.message,
        hasData: !!result.data
      })

      const { user: userData, tokens: authTokens } = result.data
      console.log('🔐 AuthContext: Setting registration state with:', { 
        userData: userData?.username, 
        hasTokens: !!authTokens 
      })
      
      setUser(userData)
      setTokens(authTokens)
      localStorage.setItem('auth_tokens', JSON.stringify(authTokens))
      
      console.log('🔐 AuthContext: Registration successful, user and tokens set')
      
      // Redirect to dashboard after successful registration
      if (typeof window !== 'undefined') {
        window.location.href = '/'
      }
      
    } catch (error) {
      console.error('🔐 AuthContext: Registration error:', error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const refreshToken = async (): Promise<void> => {
    if (!tokens?.refreshToken) {
      throw new Error('No refresh token available')
    }

    try {
      const result = await api.post<any>('/api/v1/auth/refresh', { refreshToken: tokens.refreshToken })
      const newTokens = result.data.tokens
      setTokens(newTokens)
      localStorage.setItem('auth_tokens', JSON.stringify(newTokens))
      
    } catch (error) {
      console.error('Token refresh error:', error)
      throw error
    }
  }

  const logout = async (): Promise<void> => {
    try {
      console.log('🔐 AuthContext: Logout started')
      
      if (tokens?.refreshToken) {
        await api.post('/api/v1/auth/logout', { refreshToken: tokens.refreshToken })
      }
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      // Clear auth state
      setUser(null)
      setTokens(null)
      localStorage.removeItem('auth_tokens')
      
      console.log('🔐 AuthContext: State cleared, redirecting to /auth')
      
      // Redirect to login page
      if (typeof window !== 'undefined') {
        window.location.href = '/auth'
      }
    }
  }

  const value: AuthContextType = {
    user,
    tokens,
    isAuthenticated,
    isLoading,
    login,
    register,
    logout,
    refreshToken,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
