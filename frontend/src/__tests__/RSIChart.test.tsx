import { render } from '@testing-library/react'
import RSIChart from '@/components/Charts/RSIChart'

it('renders RSIChart without crashing', () => {
  // @ts-ignore
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: true, data: { klines: [] } }) })
  render(<RSIChart symbol="BTCUSDT" />)
})
