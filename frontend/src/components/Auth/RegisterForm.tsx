'use client'

import React, { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { EyeIcon, EyeSlashIcon, ArrowRightIcon } from '@heroicons/react/24/outline'
import { UserPlus } from 'lucide-react'

interface RegisterFormProps {
  onSwitchToLogin: () => void
}

export default function RegisterForm({ onSwitchToLogin }: RegisterFormProps) {
  const { register, isLoading } = useAuth()
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }))
    // Clear error when user starts typing
    if (error) setError('')
  }

  const validateForm = () => {
    if (formData.username.length < 3) {
      setError('Username must be at least 3 characters long')
      return false
    }

    if (formData.username.length > 30) {
      setError('Username must be at most 30 characters long')
      return false
    }

    if (!/^[a-zA-Z0-9]+$/.test(formData.username)) {
      setError('Username must contain only letters and numbers (no special characters or spaces)')
      return false
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return false
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long')
      return false
    }

    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&.,;:#\-_+=<>()\[\]{}|~`"'])/.test(formData.password)) {
      setError('Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character')
      return false
    }

    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')

    console.log('📝 RegisterForm: Form submitted with data:', {
      username: formData.username,
      email: formData.email,
      passwordLength: formData.password.length
    })

    if (!validateForm()) {
      console.log('❌ RegisterForm: Validation failed')
      setIsSubmitting(false)
      return
    }

    console.log('✅ RegisterForm: Validation passed, calling register API')

    try {
      await register({
        username: formData.username,
        email: formData.email,
        password: formData.password,
      })
      console.log('✅ RegisterForm: Registration successful')
    } catch (err: any) {
      console.error('❌ RegisterForm: Registration failed:', err)
      console.error('❌ RegisterForm: Error message:', err.message)
      console.error('❌ RegisterForm: Full error:', JSON.stringify(err, null, 2))
      
      // Display the detailed error message from backend
      const errorMessage = err.message || 'Registration failed. Please try again.'
      setError(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  const isFormValid = formData.username && formData.email && formData.password && formData.confirmPassword

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Card */}
      <div className="glass rounded-2xl p-4 sm:p-6 shadow-2xl border border-[var(--card-border)] bg-[var(--card-bg)]">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#AEBCC2]/10 mb-3">
            <UserPlus className="w-6 h-6 text-[#AEBCC2]" />
          </div>
          <h2 className="text-xl font-bold text-[var(--foreground)]">Create Account</h2>
          <p className="text-sm text-[var(--muted)] mt-1">Join the trading platform</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-red-500 text-sm">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username Input */}
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-[var(--foreground)] mb-2">
              Username
            </label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              minLength={3}
              maxLength={30}
              pattern="[a-zA-Z0-9]+"
              className="w-full px-4 py-3 sm:py-3 bg-[var(--background)] border border-[var(--card-border)] rounded-lg 
                       focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all
                       text-[var(--foreground)] placeholder-[var(--muted)] text-base sm:text-sm"
              placeholder="e.g. john123 (letters and numbers only)"
              disabled={isSubmitting}
            />
            <p className="text-xs text-[var(--muted)] mt-1">
              3-30 characters, letters and numbers only (no spaces or special characters)
            </p>
          </div>

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
              placeholder="Enter your email"
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
                minLength={8}
                className="w-full px-4 py-3 sm:py-3 pr-12 bg-[var(--background)] border border-[var(--card-border)] rounded-lg 
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all
                         text-[var(--foreground)] placeholder-[var(--muted)] text-base sm:text-sm"
                placeholder="Create a strong password"
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
            <p className="text-xs text-[var(--muted)] mt-1">
              Must contain uppercase, lowercase, number, and special character
            </p>
          </div>

          {/* Confirm Password Input */}
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-[var(--foreground)] mb-2">
              Confirm Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 sm:py-3 pr-12 bg-[var(--background)] border border-[var(--card-border)] rounded-lg 
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all
                         text-[var(--foreground)] placeholder-[var(--muted)] text-base sm:text-sm"
                placeholder="Confirm your password"
                disabled={isSubmitting}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                disabled={isSubmitting}
              >
                {showConfirmPassword ? (
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
            disabled={!isFormValid || isSubmitting}
            className="group w-full bg-[#AEBCC2] hover:bg-[#9BA8AE] disabled:bg-gray-400 disabled:cursor-not-allowed 
                     text-white py-3 px-4 rounded-lg font-medium transition-all duration-200
                     shadow-lg shadow-[#AEBCC2]/25 hover:shadow-[#AEBCC2]/40 disabled:shadow-none"
          >
            <div className="flex items-center justify-center gap-2">
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  Creating Account...
                </>
              ) : (
                <>
                  Create Account
                  <ArrowRightIcon className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </div>
          </button>
        </form>

        {/* Footer */}
        <div className="mt-4 text-center">
          <p className="text-sm text-[var(--muted)]">
            Already have an account?{' '}
            <button
              onClick={onSwitchToLogin}
              className="text-[#AEBCC2] hover:text-[#9BA8AE] font-medium transition-colors"
              disabled={isSubmitting}
            >
              Sign in
            </button>
          </p>
        </div>

        {/* Account Requirements Info */}
        <div className="mt-4 p-3 bg-[#AEBCC2]/5 border border-[#AEBCC2]/10 rounded-lg">
          <p className="text-xs text-[var(--muted)] text-center">
            <strong className="text-[var(--foreground)]">Account Requirements</strong><br />
            <strong>Username:</strong> 3-30 chars, letters/numbers • <strong>Password:</strong> 8+ chars, mixed case, number & symbol
          </p>
        </div>
      </div>

      {/* Trust Indicators */}
      <div className="mt-4 text-center">
        <p className="text-xs text-[var(--muted)]">
          🔒 Your information is encrypted and secure
        </p>
      </div>
    </div>
  )
}
