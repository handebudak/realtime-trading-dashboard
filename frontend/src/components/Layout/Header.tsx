'use client'

import { useState, useEffect } from 'react'
import { Wifi, WifiOff, Bell, User, LogOut, Sun, Moon, TrendingUp } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'

export default function Header() {
  const [isOnline, setIsOnline] = useState(true)
  const [currentTime, setCurrentTime] = useState<string>('')
  const [mounted, setMounted] = useState(false)
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()

  useEffect(() => {
    setMounted(true)
    setCurrentTime(new Date().toLocaleTimeString())
    
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString())
    }, 1000)

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      clearInterval(timer)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return (
    <header className="bg-[var(--card-bg)] shadow-lg border-b border-[var(--card-border)] backdrop-blur-sm">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Left Side - Branding */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 ml-16 lg:ml-0">
              <div className="w-8 h-8 bg-[#AEBCC2] rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-lg font-bold text-[var(--foreground)]">Trading Dashboard</h1>
                <p className="text-xs text-[var(--muted)] -mt-1">Track crypto markets and execute trades.</p>
              </div>
            </div>
          </div>

          {/* Middle - Status Indicators */}
          <div className="hidden md:flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              {isOnline ? (
                <Wifi className="h-5 w-5 text-green-500" />
              ) : (
                <WifiOff className="h-5 w-5 text-red-500" />
              )}
              <span className="text-sm text-[var(--muted)] font-medium">
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
            
            <div className="text-sm text-[var(--muted)] font-mono">
              {mounted ? currentTime : '--:--:--'}
            </div>
          </div>

          {/* Right Side - Actions */}
          <div className="flex items-center space-x-1 sm:space-x-3">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-1.5 sm:p-2 text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--background)] 
                       rounded-lg transition-all duration-200"
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4 sm:h-5 sm:w-5" />
              ) : (
                <Moon className="h-4 w-4 sm:h-5 sm:w-5" />
              )}
            </button>

            {/* Notifications */}
            <button className="p-1.5 sm:p-2 text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--background)] 
                             rounded-lg transition-all duration-200 relative">
              <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="absolute top-0.5 right-0.5 sm:top-1 sm:right-1 h-2 w-2 bg-red-500 rounded-full animate-pulse"></span>
            </button>
            
            {/* User Menu */}
            <div className="flex items-center gap-1 sm:gap-2 border-l border-[var(--card-border)] pl-1 sm:pl-3">
              {/* Mobile Compact User */}
              <div className="flex items-center gap-1 sm:gap-2 px-1 sm:px-3 py-1 sm:py-2 rounded-lg bg-[var(--background)]">
                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-[#AEBCC2] flex items-center justify-center">
                  <span className="text-white text-xs sm:text-sm font-semibold">
                    {user?.username?.[0]?.toUpperCase() || 'U'}
                  </span>
                </div>
                <div className="hidden sm:flex items-center gap-2">
                  <span className="text-sm font-medium text-[var(--foreground)]">
                    {user?.username || 'User'}
                  </span>
                  <span className="text-xs px-2 py-1 rounded-md bg-[#AEBCC2]/10 text-[#AEBCC2] font-medium">
                    {user?.role || 'trader'}
                  </span>
                </div>
                {/* Mobile: Show only first letter + role */}
                <div className="sm:hidden text-xs text-[var(--muted)]">
                  {user?.role || 'trader'}
                </div>
              </div>
              
              <button 
                onClick={logout}
                className="p-1 sm:p-2 text-[var(--muted)] hover:text-red-500 hover:bg-red-500/10 
                         rounded-lg transition-all duration-200 flex-shrink-0"
                title="Logout"
              >
                <LogOut className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
