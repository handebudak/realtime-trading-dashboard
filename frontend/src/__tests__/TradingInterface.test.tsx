import { render, screen } from '@testing-library/react'
import TradingInterface from '@/components/Trading/TradingInterface'
import { AuthProvider } from '@/contexts/AuthContext'

function Wrapper({ children }: { children: React.ReactNode }) {
  // @ts-ignore
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: true, data: {} }) })
  return <AuthProvider>{children}</AuthProvider>
}

it('renders trading interface with quantity input and submit button', () => {
  render(
    <Wrapper>
      <TradingInterface />
    </Wrapper>
  )
  // type=number input has role "spinbutton"; label isn't explicitly associated in markup
  expect(screen.getByPlaceholderText('0.00000')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /order/i })).toBeInTheDocument()
})
