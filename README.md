# Car Wash Controller

A full-stack web application for controlling a car wash system using a Waveshare Industrial 6-Channel ESP32-S3 board.

## 🚀 Tech Stack

- **Frontend**: Next.js 14 + TailwindCSS + TypeScript
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL (Supabase)
- **Payment**: Stripe for subscription billing
- **Deployment**: Vercel (Frontend) + Render (Backend)
- **Hardware**: Waveshare Industrial 6-Channel ESP32-S3

## 🏗️ Architecture

```
├── frontend/          # Next.js application
├── backend/           # Express API server
├── esp32/            # ESP32 firmware
└── docs/             # Documentation
```

## 🎯 Features

### Frontend
- Customer management (name, RFID tag, membership status)
- Wash type management (duration, pricing, etc.)
- Stripe integration for subscriptions
- Manual override panel for relay control
- Real-time status monitoring

### Backend
- REST API for customer and wash management
- Stripe webhook handling
- **Hybrid ESP32 Communication**: Direct calls + polling system
  - **Instant Frontend Triggers**: Direct HTTP calls to ESP32 (~100ms response)
  - **RFID/Background Tasks**: Traditional polling system (10s interval)
  - **Auto-Fallback**: Direct calls fallback to polling if ESP32 unreachable
- Database operations with PostgreSQL

### ESP32
- **Dual Communication Modes**:
  - **Direct HTTP Endpoints**: Instant response for frontend triggers
  - **Polling System**: Background command checking every 10 seconds
- 6-channel relay management with precise timing
- 500ms relay cycles with automatic shutoff
- WiFi auto-configuration with captive portal
- Real-time activity logging and web interface

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL database
- Stripe account
- ESP32-S3 board

### Development Setup

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd Carwash
   ```

2. **Backend Setup**
   ```bash
   cd backend
   npm install
   cp .env.example .env
   # Configure your environment variables
   npm run dev
   ```

3. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   cp .env.local.example .env.local
   # Configure your environment variables
   npm run dev
   ```

4. **ESP32 Setup**
   ```bash
   cd esp32
   # Upload firmware to your ESP32-S3 board
   ```

## 🔧 Environment Variables

### Backend (.env)
```
DATABASE_URL=postgresql://...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
JWT_SECRET=your-jwt-secret
ESP32_BASE_URL=http://192.168.1.100
```

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

## 🚀 Deployment

### Frontend (Vercel)
- Connect your GitHub repository to Vercel
- Configure environment variables in Vercel dashboard
- Deploy automatically on push to main branch

### Backend (Render)
- Connect your GitHub repository to Render
- Configure environment variables in Render dashboard
- Set build command: `cd backend && npm install && npm run build`
- Set start command: `cd backend && npm start`

### Database (Supabase)
- Create a new Supabase project
- Run database migrations
- Update DATABASE_URL in backend environment

## 📊 API Endpoints

### Customers
- `GET /api/customers` - List all customers
- `POST /api/customers` - Create customer
- `GET /api/customers/:id` - Get customer details
- `PUT /api/customers/:id` - Update customer
- `DELETE /api/customers/:id` - Delete customer

### Wash Types
- `GET /api/wash-types` - List wash types
- `POST /api/wash-types` - Create wash type
- `PUT /api/wash-types/:id` - Update wash type
- `DELETE /api/wash-types/:id` - Delete wash type

### Relay Control
- `POST /api/trigger/:relayId` - **Hybrid relay trigger** (tries direct ESP32 call first, falls back to polling)
- `GET /api/trigger/status` - Get ESP32 connection status
- `GET /api/trigger/poll` - ESP32 polling endpoint for background commands
- `GET /api/trigger/queue` - Debug endpoint showing ESP32 connectivity and queue status

### Stripe
- `POST /api/stripe/webhook` - Handle Stripe webhooks
- `POST /api/stripe/create-subscription` - Create subscription
- `POST /api/stripe/cancel-subscription` - Cancel subscription

## 🔌 Hardware Setup

### ESP32-S3 Pinout
- Relay 1: GPIO 1 (Wash Type 1)
- Relay 2: GPIO 2 (Wash Type 2)
- Relay 3: GPIO 3 (Wash Type 3)
- Relay 4: GPIO 4 (Wash Type 4)
- Relay 5: GPIO 5 (Reset)

### Relay Control Logic
- Relays 1-4: ON → 500ms delay → OFF
- Relay 5: Reset functionality

## 📊 Request Optimization & Performance

The system uses a **hybrid communication approach** for optimal performance:

### Hybrid ESP32 Communication
- **Frontend Triggers**: Direct HTTP calls to ESP32 (~100ms response time)
- **RFID/Background**: Polling system (10-second intervals)
- **Auto-Fallback**: Seamless fallback to polling if direct calls fail

### Performance Metrics
| Trigger Type | Response Time | Method |
|--------------|---------------|---------|
| **Frontend Manual** | ~100ms | Direct ESP32 call |
| **RFID Scans** | 0-10 seconds | Polling system |
| **Background Tasks** | 0-10 seconds | Polling system |

### Request Volume Optimization
- **ESP32 Polling**: Reduced to 10s intervals (~360 requests/hour)
- **Direct Calls**: Only when needed (frontend triggers)
- **Rate Limiting**: 15 requests/minute for ESP32 polling
- **Smart Caching**: 5-second cache for status endpoints
- **Frontend Polling**: 15-30s intervals with visibility-based pausing

### Expected Request Volume
- ESP32 polling: ~360 requests/hour
- Direct ESP32 calls: ~50-100 requests/hour (user-dependent)
- Frontend polling: ~240 requests/hour per active user
- **Total estimated**: ~650-900 requests/hour (well within hosting limits)

### Benefits
- ⚡ **30x faster** frontend response (3000ms → 100ms)
- 🔄 **50% fewer** background polls (3s → 10s intervals)
- 🛡️ **Robust fallback** system prevents lost commands
- 📊 **Efficient resource** usage with smart caching

## 📝 License

MIT License - see LICENSE file for detail(s) 