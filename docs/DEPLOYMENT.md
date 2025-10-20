# 🚀 Deployment Guide

Complete guide for deploying the Trading Dashboard to production.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Database Setup](#database-setup)
4. [Backend Deployment](#backend-deployment)
5. [Frontend Deployment](#frontend-deployment)
6. [Docker Deployment](#docker-deployment)
7. [Cloud Providers](#cloud-providers)
8. [CI/CD Pipeline](#cicd-pipeline)
9. [Monitoring & Logging](#monitoring--logging)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software

- **Node.js:** >= 18.0.0
- **npm/yarn:** Latest version
- **Docker:** >= 20.10 (optional)
- **Git:** Latest version

### Infrastructure Requirements

- **CPU:** 2+ cores (4+ recommended)
- **RAM:** 4GB minimum (8GB recommended)
- **Storage:** 50GB minimum (SSD recommended)
- **Network:** Static IP (for production)

---

## Environment Setup

### Production Environment Variables

#### Backend `.env`

```env
# Server
PORT=3002
NODE_ENV=production
HOST=0.0.0.0

# JWT
JWT_SECRET=<GENERATE_STRONG_SECRET_KEY>
JWT_ACCESS_EXPIRY=24h
JWT_REFRESH_EXPIRY=7d

# PostgreSQL
POSTGRES_HOST=<production_db_host>
POSTGRES_PORT=5432
POSTGRES_USER=trading_user
POSTGRES_PASSWORD=<STRONG_PASSWORD>
POSTGRES_DATABASE=trading_db
POSTGRES_SSL=true

# ClickHouse
CLICKHOUSE_HOST=http://<clickhouse_host>
CLICKHOUSE_PORT=8123
CLICKHOUSE_DATABASE=trading_db
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=<STRONG_PASSWORD>

# Redis
REDIS_HOST=<redis_host>
REDIS_PORT=6379
REDIS_PASSWORD=<STRONG_PASSWORD>
REDIS_TLS=true

# Binance
BINANCE_API_URL=https://api.binance.com
BINANCE_WS_URL=wss://stream.binance.com:9443/ws

# CORS
CORS_ORIGIN=https://yourdomain.com

# Backfill
SKIP_BACKFILL=false

# Logging
LOG_LEVEL=info
```

#### Frontend `.env.production`

```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_WS_URL=wss://api.yourdomain.com/ws
```

### Generating Secrets

```bash
# JWT Secret (256-bit)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Or use openssl
openssl rand -hex 32
```

---

## Database Setup

### PostgreSQL

#### 1. Create Database

```sql
CREATE DATABASE trading_db;
CREATE USER trading_user WITH ENCRYPTED PASSWORD 'your_strong_password';
GRANT ALL PRIVILEGES ON DATABASE trading_db TO trading_user;
```

#### 2. Run Migrations

```bash
# Migrations run automatically on first start
# Or manually:
npm run migrate
```

#### 3. Create Demo User (Optional)

```bash
cd backend
npx ts-node src/scripts/createDemoUser.ts
```

### ClickHouse

#### 1. Install ClickHouse

**Ubuntu/Debian:**
```bash
sudo apt-get install -y apt-transport-https ca-certificates dirmngr
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 8919F6BD2B48D754

echo "deb https://packages.clickhouse.com/deb stable main" | sudo tee \
    /etc/apt/sources.list.d/clickhouse.list
sudo apt-get update

sudo apt-get install -y clickhouse-server clickhouse-client

sudo service clickhouse-server start
```

#### 2. Initialize Schema

```bash
clickhouse-client -d trading_db < backend/clickhouse_setup.sql
```

#### 3. Configure Security

```xml
<!-- /etc/clickhouse-server/users.xml -->
<users>
    <default>
        <password_sha256_hex>SHA256_HASH</password_sha256_hex>
    </default>
</users>
```

### Redis

#### 1. Install Redis

```bash
sudo apt-get install redis-server

# Enable on boot
sudo systemctl enable redis-server
```

#### 2. Configure

```bash
# /etc/redis/redis.conf
requirepass your_strong_password
bind 0.0.0.0
maxmemory 256mb
maxmemory-policy allkeys-lru
```

#### 3. Restart

```bash
sudo systemctl restart redis-server
```

---

## Backend Deployment

### Option 1: PM2 (Process Manager)

#### 1. Install PM2

```bash
npm install -g pm2
```

#### 2. Build Backend

```bash
cd backend
npm install
npm run build
```

#### 3. Start with PM2

```bash
pm2 start dist/index.js --name trading-backend \
  --instances 2 \
  --max-memory-restart 500M \
  --log /var/log/pm2/trading-backend.log

# Save configuration
pm2 save

# Setup startup script
pm2 startup
```

#### 4. PM2 Monitoring

```bash
pm2 status
pm2 logs trading-backend
pm2 monit
```

### Option 2: Systemd Service

#### 1. Create Service File

```bash
sudo nano /etc/systemd/system/trading-backend.service
```

```ini
[Unit]
Description=Trading Dashboard Backend
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/trading-dashboard/backend
Environment=NODE_ENV=production
ExecStart=/usr/bin/node /var/www/trading-dashboard/backend/dist/index.js
Restart=on-failure
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=trading-backend

[Install]
WantedBy=multi-user.target
```

#### 2. Enable & Start

```bash
sudo systemctl daemon-reload
sudo systemctl enable trading-backend
sudo systemctl start trading-backend

# Check status
sudo systemctl status trading-backend
```

---

## Frontend Deployment

### Option 1: Vercel (Recommended)

#### 1. Install Vercel CLI

```bash
npm install -g vercel
```

#### 2. Deploy

```bash
cd frontend
vercel --prod
```

#### 3. Environment Variables

Add in Vercel dashboard:
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_WS_URL`

### Option 2: Nginx + Static Build

#### 1. Build Frontend

```bash
cd frontend
npm install
npm run build
```

#### 2. Install Nginx

```bash
sudo apt-get install nginx
```

#### 3. Configure Nginx

```nginx
# /etc/nginx/sites-available/trading-dashboard
server {
    listen 80;
    server_name yourdomain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket
    location /ws {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
}
```

#### 4. Enable Site

```bash
sudo ln -s /etc/nginx/sites-available/trading-dashboard /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### 5. SSL Certificate (Let's Encrypt)

```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

---

## Docker Deployment

### Option 1: Docker Compose (Full Stack)

#### 1. Create `docker-compose.prod.yml`

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_USER: trading_user
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: trading_db
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: always

  clickhouse:
    image: clickhouse/clickhouse-server:latest
    environment:
      CLICKHOUSE_USER: default
      CLICKHOUSE_PASSWORD: ${CLICKHOUSE_PASSWORD}
    volumes:
      - clickhouse_data:/var/lib/clickhouse
      - ./backend/clickhouse_setup.sql:/docker-entrypoint-initdb.d/init.sql
    restart: always

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    restart: always

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      NODE_ENV: production
      POSTGRES_HOST: postgres
      REDIS_HOST: redis
      CLICKHOUSE_HOST: http://clickhouse
    ports:
      - "3002:3002"
    depends_on:
      - postgres
      - clickhouse
      - redis
    restart: always

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    environment:
      NEXT_PUBLIC_API_URL: https://api.yourdomain.com
    ports:
      - "3000:3000"
    depends_on:
      - backend
    restart: always

volumes:
  postgres_data:
  clickhouse_data:
  redis_data:
```

#### 2. Backend Dockerfile

```dockerfile
# backend/Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 3002

# Start
CMD ["node", "dist/index.js"]
```

#### 3. Frontend Dockerfile

```dockerfile
# frontend/Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:18-alpine AS runner

WORKDIR /app

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

CMD ["npm", "start"]
```

#### 4. Deploy

```bash
# Build images
docker-compose -f docker-compose.prod.yml build

# Start services
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

---

## Cloud Providers

### AWS Deployment

#### Architecture

```
┌──────────────────────────────────────┐
│         CloudFront (CDN)              │
└────────────┬─────────────────────────┘
             │
┌────────────▼─────────────────────────┐
│         ALB (Load Balancer)           │
└────┬────────────────────┬─────────────┘
     │                    │
┌────▼────────┐    ┌──────▼──────┐
│   ECS/EKS   │    │   ECS/EKS   │
│  Frontend   │    │   Backend   │
└─────────────┘    └──────┬──────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
   ┌────▼────┐      ┌─────▼────┐     ┌─────▼─────┐
   │   RDS   │      │ElastiCache│     │  Custom  │
   │(Postgres)│      │  (Redis)  │     │ClickHouse│
   └─────────┘      └───────────┘     └───────────┘
```

#### Services

- **Compute:** ECS (Fargate) or EKS
- **Database:** RDS PostgreSQL
- **Cache:** ElastiCache (Redis)
- **ClickHouse:** EC2 instance
- **Load Balancer:** Application Load Balancer
- **CDN:** CloudFront
- **Storage:** S3
- **SSL:** ACM (AWS Certificate Manager)

---

## CI/CD Pipeline

### GitHub Actions

#### `.github/workflows/deploy.yml`

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install Backend Dependencies
        run: cd backend && npm ci
      
      - name: Run Backend Tests
        run: cd backend && npm test
      
      - name: Install Frontend Dependencies
        run: cd frontend && npm ci
      
      - name: Run Frontend Tests
        run: cd frontend && npm test

  deploy-backend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to Server
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /var/www/trading-dashboard/backend
            git pull origin main
            npm install
            npm run build
            pm2 restart trading-backend

  deploy-frontend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
          vercel-args: '--prod'
          working-directory: ./frontend
```

---

## Monitoring & Logging

### Logging

#### 1. Winston Configuration (Production)

```typescript
// backend/src/utils/logger.ts
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ 
      filename: '/var/log/trading/error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: '/var/log/trading/combined.log' 
    }),
  ],
})
```

#### 2. Log Rotation

```bash
# /etc/logrotate.d/trading-dashboard
/var/log/trading/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        systemctl reload trading-backend
    endscript
}
```

### Monitoring

#### 1. PM2 Monitoring

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

#### 2. Application Monitoring (Recommended Tools)

- **New Relic:** Full-stack observability
- **Datadog:** Infrastructure & APM monitoring
- **Sentry:** Error tracking
- **Prometheus + Grafana:** Metrics visualization

---

## Troubleshooting

### Common Issues

#### 1. WebSocket Connection Failed

**Symptom:** Frontend can't connect to WebSocket

**Solution:**
- Check Nginx WebSocket proxy configuration
- Verify CORS settings
- Check firewall rules (port 3002)
- Ensure JWT token is valid

#### 2. ClickHouse Connection Error

**Symptom:** "Connection refused" on port 8123

**Solution:**
```bash
# Check ClickHouse status
sudo systemctl status clickhouse-server

# Check logs
sudo tail -f /var/log/clickhouse-server/clickhouse-server.err.log

# Restart
sudo systemctl restart clickhouse-server
```

#### 3. High Memory Usage

**Solution:**
```bash
# Backend
pm2 restart trading-backend --max-memory-restart 500M

# ClickHouse
# Reduce max_memory_usage in config
```

#### 4. Database Connection Pool Exhausted

**Solution:**
```typescript
// Increase pool size
const pool = new Pool({
  max: 50,  // Increase from 20
  idleTimeoutMillis: 30000,
})
```

---

## Security Checklist

- [ ] Change all default passwords
- [ ] Enable SSL/TLS everywhere
- [ ] Configure firewall (ufw/iptables)
- [ ] Enable rate limiting
- [ ] Set up fail2ban
- [ ] Regular security updates
- [ ] Database backups configured
- [ ] Monitoring & alerts set up
- [ ] Secrets in environment variables
- [ ] CORS properly configured

---

## Performance Checklist

- [ ] Enable gzip compression (Nginx)
- [ ] CDN configured (CloudFront/Cloudflare)
- [ ] Database indexes optimized
- [ ] Redis caching enabled
- [ ] PM2 cluster mode (multiple instances)
- [ ] Static assets minified
- [ ] Images optimized
- [ ] HTTP/2 enabled

---

## Backup Strategy

### Database Backups

```bash
# PostgreSQL daily backup
0 2 * * * pg_dump trading_db | gzip > /backups/postgres-$(date +\%Y\%m\%d).sql.gz

# ClickHouse backup
0 3 * * * clickhouse-backup create && clickhouse-backup upload
```

### Retention Policy

- **Daily:** Keep 7 days
- **Weekly:** Keep 4 weeks
- **Monthly:** Keep 12 months

---

## Rollback Procedure

### Quick Rollback

```bash
# Backend
cd /var/www/trading-dashboard/backend
git checkout <previous-commit>
npm install
npm run build
pm2 restart trading-backend

# Frontend (Vercel)
vercel --prod <previous-deployment-url>
```

---

**Deployment Complete!** 🎉

For support, contact: support@trading-dashboard.com

