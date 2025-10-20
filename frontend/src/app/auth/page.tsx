'use client'

import React, { useState } from 'react'
import LoginForm from '@/components/Auth/LoginForm'
import RegisterForm from '@/components/Auth/RegisterForm'
import { TrendingUp } from 'lucide-react'

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)

  return (
    <div className="min-h-screen bg-[var(--background)] flex items-center justify-center py-6 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      <div className="max-w-md w-full relative z-10 mx-auto">
        {/* Universal Header Branding - Shows on all screens */}
        <div className="text-center mb-6 space-y-2">
          <div className="inline-flex items-center gap-2">
            <div className="w-8 h-8 bg-[#AEBCC2] rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-[var(--foreground)]">
              Trading Dashboard
            </h1>
          </div>
          <p className="text-sm text-[var(--muted)] max-w-xs mx-auto">
            Track crypto markets and execute trades.
          </p>
        </div>

        {/* Auth Form - Centered */}
        <div className="space-y-4">
          {isLogin ? (
            <LoginForm onSwitchToRegister={() => setIsLogin(false)} />
          ) : (
            <RegisterForm onSwitchToLogin={() => setIsLogin(true)} />
          )}

          <div className="text-center">
            <p className="text-xs text-[var(--muted)]">
              By continuing, you agree to our{' '}
              <a href="#" className="text-[#AEBCC2] hover:text-[#9BA8AE] transition-colors">
                Terms of Service
              </a>{' '}
              and{' '}
              <a href="#" className="text-[#AEBCC2] hover:text-[#9BA8AE] transition-colors">
                Privacy Policy
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
