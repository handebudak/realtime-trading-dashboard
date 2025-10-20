'use client'

import { useState } from 'react'
import { ArrowUp, ArrowDown, DollarSign } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/services/apiClient'

export default function TradingInterface() {
  const [orderType, setOrderType] = useState<'buy' | 'sell'>('buy')
  const [symbol, setSymbol] = useState('BTCUSDT')
  const [quantity, setQuantity] = useState('')
  const [price, setPrice] = useState('')
  const [orderTypeSelect, setOrderTypeSelect] = useState<'market' | 'limit'>('market')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const { tokens } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')
    
    try {
      if (!tokens?.accessToken) {
        throw new Error('Authentication required')
      }

      const data = await api.post<any>('/api/v1/trading/orders', {
        symbol,
        side: orderType,
        type: orderTypeSelect,
        quantity: quantity,
        price: orderTypeSelect === 'limit' ? price : undefined,
      }, { headers: { 'Authorization': `Bearer ${tokens.accessToken}` } })
      
      if (data.success) {
        alert('Order placed successfully!')
        setQuantity('')
        setPrice('')
      } else {
        // Handle error response - extract message from nested error object
        let errorMessage = 'Failed to place order'
        
        if (data.error) {
          // If error is an object with message property
          if (typeof data.error === 'object' && data.error.message) {
            errorMessage = data.error.message
            // If there are validation details, append them
            if (data.error.details && Array.isArray(data.error.details)) {
              const detailMessages = data.error.details.map((d: any) => `${d.field}: ${d.message}`).join(', ')
              errorMessage += ` (${detailMessages})`
            }
          } else if (typeof data.error === 'string') {
            errorMessage = data.error
          }
        } else if (data.message) {
          errorMessage = data.message
        }
        
        setError(errorMessage)
      }
    } catch (error: any) {
      console.error('Error placing order:', error)
      setError(error.message || 'Error placing order')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="glass rounded-2xl shadow-lg border border-[var(--card-border)] bg-[var(--card-bg)]">
      <div className="px-3 sm:px-4 py-3 border-b border-[var(--card-border)]">
        <h2 className="text-base sm:text-lg font-semibold text-[var(--foreground)]">Trading Interface</h2>
      </div>
      
      <div className="p-3 sm:p-4">
        {/* Order Type Toggle */}
        <div className="flex mb-3 sm:mb-4 rounded-lg overflow-hidden border border-[var(--card-border)]">
          <button
            onClick={() => setOrderType('buy')}
            className={`flex-1 py-2 px-2 sm:px-3 text-sm font-medium transition-all duration-200 ${
              orderType === 'buy'
                ? 'bg-[#2EBD85] text-white shadow-md'
                : 'bg-[var(--background)] text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--card-bg)]'
            }`}
          >
            <ArrowUp className="h-4 w-4 inline mr-1 sm:mr-2" />
            Buy
          </button>
          <button
            onClick={() => setOrderType('sell')}
            className={`flex-1 py-2 px-2 sm:px-3 text-sm font-medium transition-all duration-200 ${
              orderType === 'sell'
                ? 'bg-[#F6465D] text-white shadow-md'
                : 'bg-[var(--background)] text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--card-bg)]'
            }`}
          >
            <ArrowDown className="h-4 w-4 inline mr-1 sm:mr-2" />
            Sell
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-3 p-3 bg-[#F6465D]/10 border border-[#F6465D]/20 rounded-lg">
            <p className="text-[#F6465D] text-sm">{error}</p>
          </div>
        )}

        {/* Order Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Symbol */}
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1 sm:mb-2">
              Symbol
            </label>
            <select
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="w-full px-3 sm:px-4 py-2 bg-[var(--background)] border border-[var(--card-border)] rounded-lg 
                       focus:ring-2 focus:ring-[#AA5571] focus:border-transparent transition-all
                       text-[var(--foreground)] text-sm"
            >
              <option value="BTCUSDT">BTC/USDT</option>
              <option value="ETHUSDT">ETH/USDT</option>
              <option value="ADAUSDT">ADA/USDT</option>
              <option value="BNBUSDT">BNB/USDT</option>
              <option value="SOLUSDT">SOL/USDT</option>
              <option value="XRPUSDT">XRP/USDT</option>
            </select>
          </div>

          {/* Order Type */}
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1 sm:mb-2">
              Order Type
            </label>
            <select
              value={orderTypeSelect}
              onChange={(e) => setOrderTypeSelect(e.target.value as 'market' | 'limit')}
              className="w-full px-3 sm:px-4 py-2 bg-[var(--background)] border border-[var(--card-border)] rounded-lg 
                       focus:ring-2 focus:ring-[#AA5571] focus:border-transparent transition-all
                       text-[var(--foreground)] text-sm"
            >
              <option value="market">Market</option>
              <option value="limit">Limit</option>
            </select>
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1 sm:mb-2">
              Quantity
            </label>
            <input
              type="number"
              step="0.00001"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full px-3 sm:px-4 py-2 bg-[var(--background)] border border-[var(--card-border)] rounded-lg 
                       focus:ring-2 focus:ring-[#AA5571] focus:border-transparent transition-all
                       text-[var(--foreground)] placeholder-[var(--muted)] text-sm"
              placeholder="0.00000"
              required
            />
          </div>

          {/* Price (only for limit orders) */}
          {orderTypeSelect === 'limit' && (
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1 sm:mb-2">
                Price
              </label>
              <input
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full px-3 sm:px-4 py-2 bg-[var(--background)] border border-[var(--card-border)] rounded-lg 
                         focus:ring-2 focus:ring-[#AA5571] focus:border-transparent transition-all
                         text-[var(--foreground)] placeholder-[var(--muted)] text-sm"
                placeholder="0.00"
                required
              />
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-2 px-4 rounded-lg font-medium text-white transition-all duration-200
                       focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed
                       shadow-md ${
              orderType === 'buy'
                ? 'bg-[#2EBD85] hover:bg-[#26A673] focus:ring-[#2EBD85] shadow-[#2EBD85]/25'
                : 'bg-[#F6465D] hover:bg-[#E53E5A] focus:ring-[#F6465D] shadow-[#F6465D]/25'
            }`}
          >
            {isSubmitting ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Placing Order...
              </div>
            ) : (
              <div className="flex items-center justify-center gap-1 sm:gap-2">
                {orderType === 'buy' ? (
                  <>
                    <ArrowUp className="h-4 w-4" />
                    <span className="hidden sm:inline">Place</span> Buy Order
                  </>
                ) : (
                  <>
                    <ArrowDown className="h-4 w-4" />
                    <span className="hidden sm:inline">Place</span> Sell Order
                  </>
                )}
              </div>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}