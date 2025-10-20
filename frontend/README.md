# 🎨 Trading Dashboard Frontend

Modern, responsive, high-performance trading dashboard built with **Next.js 15**, **React 19**, and **TypeScript**.

---

## 📚 Tech Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| Next.js | 15.5.5 | React framework with SSR |
| React | 19.x | UI library |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 3.x | Utility-first CSS |
| Chart.js | 4.x | Financial charts |
| WebSocket API | Native | Real-time data |

---

## 📁 Project Structure

```
frontend/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── page.tsx                 # Dashboard (Main page)
│   │   ├── layout.tsx               # Root layout
│   │   ├── globals.css              # Global styles
│   │   ├── auth/                    # Authentication pages
│   │   │   └── page.tsx            # Login/Register page
│   │   └── historical/              # Historical data analysis
│   │       └── page.tsx            # Charts page
│   │
│   ├── components/                  # React Components
│   │   ├── Auth/                   # Authentication
│   │   │   ├── LoginForm.tsx
│   │   │   ├── RegisterForm.tsx
│   │   │   └── ProtectedRoute.tsx
│   │   │
│   │   ├── Charts/                 # Trading Charts
│   │   │   ├── DayTradingChart.tsx
│   │   │   ├── ScalpingChart.tsx
│   │   │   ├── SwingTradingChart.tsx
│   │   │   ├── PositionTradingChart.tsx
│   │   │   ├── LongTermInvestmentChart.tsx
│   │   │   ├── VolumeAnalysisChart.tsx
│   │   │   ├── RSIChart.tsx
│   │   │   └── TradingPresets.tsx
│   │   │
│   │   ├── Trading/                # Trading Interface
│   │   │   ├── TradingInterface.tsx   # Order placement
│   │   │   └── RecentTrades.tsx       # Trade history
│   │   │
│   │   ├── System/                 # System Monitoring
│   │   │   ├── SystemMetrics.tsx      # Performance metrics
│   │   │   └── AlertNotifications.tsx  # Alert system
│   │   │
│   │   ├── MarketData/             # Market Data
│   │   │   └── MarketDataOverview.tsx
│   │   │
│   │   ├── Dashboard/              # Dashboard Components
│   │   │   └── index.tsx
│   │   │
│   │   └── Layout/                 # Layout Components
│   │       ├── MainLayout.tsx         # Main layout wrapper
│   │       ├── Header.tsx             # Top header
│   │       └── Sidebar.tsx            # Side navigation
│   │
│   ├── contexts/                    # React Contexts
│   │   ├── AuthContext.tsx         # Authentication state
│   │   └── ThemeContext.tsx        # Theme management
│   │
│   ├── hooks/                       # Custom Hooks
│   │   └── useWebSocket.ts         # WebSocket connection
│   │
│   └── services/                    # API Services
│       └── authService.ts          # Auth API calls
│
├── public/                          # Static Assets
│   ├── file.svg
│   ├── globe.svg
│   └── ...
│
├── package.json                     # Dependencies
├── tsconfig.json                    # TypeScript config
├── tailwind.config.js               # Tailwind config
├── next.config.ts                   # Next.js config
└── README.md                        # This file
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** >= 18.0.0
- **npm** or **yarn**

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

### Environment Variables

Create a `.env.local` file (optional):

```env
NEXT_PUBLIC_API_URL=http://localhost:3002
NEXT_PUBLIC_WS_URL=ws://localhost:3002/ws
```

**Note:** API URLs are currently hardcoded in components. For production, update to use environment variables.

---

## 🎨 Components

### 1. Authentication

#### LoginForm
- Email/password authentication
- JWT token management
- Error handling

#### RegisterForm
- User registration
- Form validation
- Success feedback

#### ProtectedRoute
- Route protection HOC
- Redirect to /auth if not authenticated

### 2. Charts

All chart components use **Chart.js** with performance optimizations:
- **No animations** (`animation: false`)
- **Imperative updates** (avoid re-renders)
- **Time scale** with zoom/pan support
- **Real-time WebSocket updates**

#### DayTradingChart
- **Timeframe:** 15m candles, 4-hour view
- **Strategy:** Intraday trading
- **Features:** Candlestick chart with zoom

#### ScalpingChart
- **Timeframe:** 5m candles, 1-hour view
- **Strategy:** Quick in-and-out trades
- **Features:** High-frequency updates

#### SwingTradingChart
- **Timeframe:** 1h candles, 1-week view
- **Strategy:** Multi-day positions
- **Features:** Extended history

#### PositionTradingChart
- **Timeframe:** 1d candles, 1-month view
- **Strategy:** Long-term positions

#### LongTermInvestmentChart
- **Timeframe:** 1d candles, 1-year view
- **Strategy:** Buy and hold

#### VolumeAnalysisChart
- **Features:**
  - Volume bars
  - MA(20) overlay
  - Real-time updates
  - Zoom/pan support

#### RSIChart
- **Indicators:**
  - RSI with multiple periods (7, 9, 14, 21, 28)
  - Overbought (70) / Oversold (30) lines
  - Color-coded zones
  - Real-time calculation

### 3. Trading Interface

#### TradingInterface
- **Order Types:** Market, Limit
- **Features:**
  - Buy/Sell toggle
  - Symbol selection
  - Quantity & price input
  - Real-time balance check
  - Order status feedback
  - Error handling

#### RecentTrades
- Trade history display
- Pagination
- Filtering

### 4. System Monitoring

#### SystemMetrics
- **Metrics:**
  - Latency (request/response time)
  - Throughput (requests/second)
  - Error rate (%)
  - Uptime (hours)
- **Features:**
  - Real-time updates (30s polling)
  - Color-coded status indicators
  - Performance trends

#### AlertNotifications
- **Features:**
  - Critical alert notifications
  - Browser push notifications
  - Alert acknowledgment
  - Alert history
  - Floating notification badge

### 5. Layout

#### MainLayout
- Responsive sidebar
- Header with user info
- Theme toggle
- Alert notifications overlay

#### Sidebar
- Navigation links
- Active route highlighting
- Collapsible on mobile

#### Header
- User profile
- Logout button
- Theme switcher

---

## 🔌 Hooks

### useWebSocket

Custom hook for WebSocket connections with:
- **Auto-reconnect** with exponential backoff
- **Connection state** tracking
- **Latency monitoring** (ping/pong)
- **Error handling**

#### Usage

```typescript
import { useWebSocket } from '@/hooks/useWebSocket'

const { isConnected, latency } = useWebSocket({
  symbol: 'BTCUSDT',
  onMessage: (data) => {
    console.log('Received:', data)
  },
  enabled: true
})
```

#### Features

- **Auto-reconnect:** Up to 10 retries with exponential backoff
- **JWT Authentication:** Token from localStorage
- **Latency Tracking:** Ping every 10 seconds
- **Clean Disconnect:** Proper cleanup on unmount

---

## 🎯 State Management

### React Context

#### AuthContext
- User authentication state
- Token management (localStorage)
- Login/logout functions
- Protected route logic

#### ThemeContext
- Theme state (light/dark)
- Theme toggle
- Persistent storage

### Local State
- `useState` for component state
- `useRef` for DOM references and imperative updates
- `useMemo` for expensive computations
- `useCallback` for event handlers

---

## ⚡ Performance Optimizations

### 1. React Performance

```typescript
// Memoization
const expensiveValue = useMemo(() => calculateRSI(data, 14), [data])
const handleClick = useCallback(() => {...}, [deps])

// Component memoization
export default React.memo(ChartComponent)

// Ref-based updates (avoid re-renders)
chartRef.current.data.labels.push(newTime)
chartRef.current.update('none') // No animation
```

### 2. Chart.js Optimizations

```typescript
options: {
  animation: false,           // Disable animations
  parsing: false,             // Manual data parsing
  normalized: true,           // Pre-normalized data
  elements: {
    point: { radius: 0 }      // No point rendering
  },
  plugins: {
    tooltip: {
      mode: 'index',
      intersect: false        // Faster tooltip
    }
  }
}
```

### 3. WebSocket Optimizations

- Only update on closed candles
- Duplicate prevention
- Batch updates
- Connection pooling

### 4. Code Splitting

- Next.js automatic code splitting
- Dynamic imports for heavy components
- Tree shaking

---

## 🎨 Styling

### Tailwind CSS

- **Utility-first** approach
- **JIT mode** for optimal performance
- **Custom colors** for trading theme
- **Dark mode** support

### CSS Variables

```css
:root {
  --background: #0F1419;
  --foreground: #FFFFFF;
  --card-bg: rgba(22, 27, 34, 0.8);
  --card-border: rgba(255, 255, 255, 0.1);
  --muted: #8B949E;
}
```

### Responsive Breakpoints

```javascript
// tailwind.config.js
screens: {
  'sm': '640px',
  'md': '768px',
  'lg': '1024px',
  'xl': '1280px',
  '2xl': '1536px',
}
```

---

## 📊 Data Flow

### Initial Data Load

```
Component Mount
    ↓
Fetch from API (/api/v1/market-data/klines)
    ↓
ClickHouse Query (or Binance if insufficient data)
    ↓
Transform Data (normalize timestamps)
    ↓
Render Chart
    ↓
Subscribe to WebSocket
```

### Real-Time Updates

```
WebSocket Message
    ↓
Parse & Validate
    ↓
Check if Closed Candle
    ↓
Update chartRef (imperative)
    ↓
Update Chart.js (no re-render)
```

---

## 🧪 Testing

### Unit Tests

```bash
npm test
```

### E2E Tests

```bash
npm run test:e2e
```

### Coverage

```bash
npm run test:coverage
```

---

## 📦 Build

### Development Build

```bash
npm run dev
```

### Production Build

```bash
# Build
npm run build

# Start production server
npm start
```

### Bundle Analysis

```bash
npm run analyze
```

---

## 🔒 Security

- **JWT Authentication:** Tokens in localStorage
- **CORS:** Configured origins
- **XSS Protection:** Content Security Policy
- **Input Validation:** Client-side validation
- **HTTPS:** Recommended for production

---

## 🚀 Deployment

### Vercel (Recommended)

```bash
vercel deploy
```

### Docker

```bash
# Build image
docker build -t trading-dashboard-frontend .

# Run container
docker run -p 3000:3000 trading-dashboard-frontend
```

### Traditional Hosting

```bash
# Build
npm run build

# Serve .next folder
# Use nginx or similar
```

---

## 🐛 Known Issues

1. **API URLs Hardcoded:** Should use environment variables
2. **No Offline Support:** WebSocket requires active connection
3. **LocalStorage Auth:** Consider HTTP-only cookies for production

---

## 🔮 Future Improvements

- [ ] Service Worker for offline support
- [ ] IndexedDB for local data caching
- [ ] WebWorker for heavy calculations
- [ ] React Server Components optimization
- [ ] Streaming SSR
- [ ] PWA support

---

## 📝 License

ISC

---

## 🤝 Contributing

1. Create feature branch
2. Make changes
3. Run linter (`npm run lint`)
4. Run tests (`npm test`)
5. Create pull request

---

## 📞 Support

- **Email:** support@trading-dashboard.com
- **Issues:** GitHub Issues
- **Docs:** [Main README](../README.md)

---

Made with ❤️ using Next.js
