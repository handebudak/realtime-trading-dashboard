'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  BarChart3, 
  History, 
  Menu,
  X,
  Home
} from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Historical', href: '/historical', icon: History },
]

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 rounded-lg bg-[var(--card-bg)] border border-[var(--card-border)] shadow-lg"
        >
          {isOpen ? <X size={24} className="text-[var(--foreground)]" /> : <Menu size={24} className="text-[var(--foreground)]" />}
        </button>
      </div>

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-[var(--card-bg)] border-r border-[var(--card-border)] 
        transform transition-transform duration-300 ease-in-out shadow-2xl
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:inset-0
      `}>
        {/* Logo */}
        <div className="flex items-center justify-center h-20 px-6 border-b border-[var(--card-border)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#AEBCC2] to-[#9BA8AE] rounded-xl flex items-center justify-center shadow-lg">
              <BarChart3 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-[var(--foreground)]">
                Trading Dashboard
              </h1>
              <p className="text-xs text-[var(--muted)]">HFT Platform</p>
            </div>
          </div>
        </div>
        
        {/* Navigation */}
        <nav className="mt-6 px-4">
          <ul className="space-y-2">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className={`
                      group flex items-center px-4 py-3 text-sm font-medium rounded-xl 
                      transition-all duration-200 relative overflow-hidden
                      ${isActive 
                        ? 'bg-[#AEBCC2] text-white shadow-lg shadow-[#AEBCC2]/25' 
                        : 'text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--background)]'
                      }
                    `}
                    onClick={() => setIsOpen(false)}
                  >
                    <item.icon className={`mr-3 h-5 w-5 transition-transform group-hover:scale-110 ${
                      isActive ? 'text-white' : ''
                    }`} />
                    {item.name}
                    {isActive && (
                      <div className="absolute right-2 w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Footer Info */}
        <div className="absolute bottom-6 left-4 right-4">
          <div className="p-4 rounded-xl bg-gradient-to-br from-[#AEBCC2]/10 to-[#9BA8AE]/10 border border-[#AEBCC2]/20">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs font-medium text-[var(--foreground)]">System Online</span>
            </div>
            <p className="text-xs text-[var(--muted)]">All services operational</p>
          </div>
        </div>
      </div>

      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  )
}
