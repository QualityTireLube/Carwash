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
- Relay control via HTTP endpoints
- Database operations with PostgreSQL

### ESP32
- HTTP server for relay control
- 6-channel relay management
- 500ms toggle logic for relays 1-4
- Reset functionality for relay 5

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
- `POST /api/trigger/:relayId` - Trigger relay (1-5)

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

## 📝 License

MIT License - see LICENSE file for details 