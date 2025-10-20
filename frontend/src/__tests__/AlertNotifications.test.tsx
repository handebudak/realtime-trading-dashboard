import { render, screen, waitFor } from '@testing-library/react'
import AlertNotifications from '@/components/System/AlertNotifications'

describe('AlertNotifications', () => {
  beforeEach(() => {
    // @ts-ignore
    global.fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve({
        success: true,
        data: {
          alerts: [
            {
              id: 'a1', type: 'LATENCY', severity: 'CRITICAL', message: 'High latency',
              value: 120, threshold: 100, timestamp: new Date().toISOString(), acknowledged: false,
            },
          ],
          unacknowledgedCount: 1,
        },
      }),
      ok: true,
    })

    // @ts-ignore
    global.Notification = { permission: 'denied' }
  })

  it('renders alert badge when there are unacknowledged alerts', async () => {
    render(<AlertNotifications />)
    await waitFor(() => expect(screen.getByText(/1 Alert/i)).toBeInTheDocument())
  })
})


