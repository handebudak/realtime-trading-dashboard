'use client'

import Sidebar from './Sidebar'
import Header from './Header'
import AlertNotifications from '../System/AlertNotifications'

interface MainLayoutProps {
  children: React.ReactNode
}

export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="flex h-screen bg-[var(--background)] overflow-hidden">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-6">
          <div className="max-w-[1920px] mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* Alert Notifications - floating on top */}
      <AlertNotifications />
    </div>
  )
}
