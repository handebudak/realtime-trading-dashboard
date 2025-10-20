'use client'

import React, { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { EyeIcon, EyeSlashIcon, ArrowRightIcon } from '@heroicons/react/24/outline'
import { TrendingUp } from 'lucide-react'

interface LoginFormProps {
  onSwitchToRegister: () => void
}

export default function LoginForm({ onSwitchToRegister }: LoginFormProps) {
  const { login } = useAuth()
  const [formData, setFormData] = useState({
    email: 'demo@example.com',
    password: 'demo123',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }))
    if (error) setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')

    try {
      await login(formData)
      // Login başarılı olduğunda AuthContext otomatik olarak dashboard'a yönlendirecek
    } catch (error) {
      console.error('Login error:', error)
      setError(error instanceof Error ? error.message : 'An error occurred during login')
    } finally {
      setIsSubmitting(false)
    }
  }

  const isFormValid = formData.email && formData.password

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Card */}
      <div className="glass rounded-2xl p-4 sm:p-6 shadow-2xl border border-[var(--card-border)] bg-[var(--card-bg)]">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#AEBCC2]/10 mb-3">
            <TrendingUp className="w-6 h-6 text-[#AEBCC2]" />
          </div>
          <h2 className="text-xl font-bold text-[var(--foreground)]">Welcome Back</h2>
          <p className="text-sm text-[var(--muted)] mt-1">Sign in to your trading account</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-red-500 text-sm">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email Input */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-[var(--foreground)] mb-2">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 sm:py-3 bg-[var(--background)] border border-[var(--card-border)] rounded-lg 
                       focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all
                       text-[var(--foreground)] placeholder-[var(--muted)] text-base sm:text-sm"
              placeholder="demo@example.com"
              disabled={isSubmitting}
            />
          </div>

          {/* Password Input */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-[var(--foreground)] mb-2">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 sm:py-3 pr-12 bg-[var(--background)] border border-[var(--card-border)] rounded-lg 
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all
                         text-[var(--foreground)] placeholder-[var(--muted)] text-base sm:text-sm"
                placeholder="Enter your password"
                disabled={isSubmitting}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                disabled={isSubmitting}
              >
                {showPassword ? (
                  <EyeSlashIcon className="h-5 w-5" />
                ) : (
                  <EyeIcon className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || !isFormValid}
            className="group w-full bg-[#AEBCC2] hover:bg-[#9BA8AE] disabled:bg-gray-400 disabled:cursor-not-allowed 
                     text-white py-3 px-4 rounded-lg font-medium transition-all duration-200
                     shadow-lg shadow-[#AEBCC2]/25 hover:shadow-[#AEBCC2]/40 disabled:shadow-none"
          >
            <div className="flex items-center justify-center gap-2">
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  Signing in...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRightIcon className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </div>
          </button>
        </form>

        {/* Footer */}
        <div className="mt-4 text-center">
          <p className="text-sm text-[var(--muted)]">
            Don't have an account?{' '}
            <button
              onClick={onSwitchToRegister}
              className="text-[#AEBCC2] hover:text-[#9BA8AE] font-medium transition-colors"
            >
              Sign up
            </button>
          </p>
        </div>

        {/* Demo Credentials */}
        <div className="mt-4 p-3 bg-[#AEBCC2]/5 border border-[#AEBCC2]/10 rounded-lg">
          <p className="text-xs text-[var(--muted)] text-center">
            <strong className="text-[var(--foreground)]">Demo Account</strong><br />
            Email: demo@example.com • Password: demo123
          </p>
        </div>
      </div>

      {/* Trust Indicators */}
      <div className="mt-4 text-center">
        <p className="text-xs text-[var(--muted)]">
          🔒 Secured with enterprise-grade encryption
        </p>
      </div>
    </div>
  )
}
