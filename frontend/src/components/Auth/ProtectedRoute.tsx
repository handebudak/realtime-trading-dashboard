'use client'

import React from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: string
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    console.log('🛡️ ProtectedRoute: Auth check:', { 
      isLoading, 
      isAuthenticated, 
      user: user?.username, 
      requiredRole 
    })
    
    if (!isLoading) {
      if (!isAuthenticated) {
        console.log('🛡️ ProtectedRoute: Not authenticated, redirecting to /auth')
        router.push('/auth')
        return
      }

      if (requiredRole && user?.role !== requiredRole) {
        console.log('🛡️ ProtectedRoute: Wrong role, redirecting to /unauthorized')
        router.push('/unauthorized')
        return
      }
      
      console.log('🛡️ ProtectedRoute: Access granted')
    }
  }, [isAuthenticated, isLoading, user, requiredRole, router])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  if (requiredRole && user?.role !== requiredRole) {
    return null
  }

  return <>{children}</>
}
