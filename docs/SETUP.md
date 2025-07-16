# Car Wash Controller Setup Guide

This guide will walk you through setting up the complete car wash controller system.

## Prerequisites

- Node.js 18+ installed
- PostgreSQL database (Supabase recommended)
- Stripe account for payments
- ESP32-S3 board with 6-channel relay module
- WiFi network for ESP32 connection

## 1. Database Setup

### Option A: Supabase (Recommended)

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run the migration script:

```sql
-- Run the contents of backend/src/database/migrations/001_initial_schema.sql
```

3. Copy your database connection string from Settings > Database

### Option B: Local PostgreSQL

1. Install PostgreSQL locally
2. Create a new database: `carwash_db`
3. Run the migration script from `backend/src/database/migrations/001_initial_schema.sql`

## 2. Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Copy environment file:
```bash
cp env.example .env
```

4. Configure environment variables in `.env`:
```env
DATABASE_URL=postgresql://username:password@localhost:5432/carwash_db
JWT_SECRET=your-super-secret-jwt-key-here
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
ESP32_BASE_URL=http://192.168.1.100
ESP32_TIMEOUT=5000
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
```

5. Start the development server:
```bash
npm run dev
```

The backend will be available at `http://localhost:3001`

## 3. Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Copy environment file:
```bash
cp env.local.example .env.local
```

4. Configure environment variables in `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
```

5. Start the development server:
```bash
npm run dev
```

The frontend will be available at `http://localhost:3000`

## 4. ESP32 Setup

### Hardware Requirements

- ESP32-S3 development board
- 6-channel relay module
- Power supply for relays
- Wiring connections

### Pin Connections

| ESP32 GPIO | Relay Module | Function |
|------------|--------------|----------|
| GPIO 1     | Relay 1      | Basic Wash |
| GPIO 2     | Relay 2      | Premium Wash |
| GPIO 3     | Relay 3      | Deluxe Wash |
| GPIO 4     | Relay 4      | Ultimate Wash |
| GPIO 5     | Relay 5      | Reset |

### Software Setup

1. Install Arduino IDE
2. Add ESP32 board support:
   - File > Preferences > Additional Board Manager URLs
   - Add: `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`
   - Tools > Board > Boards Manager > Search "ESP32" > Install

3. Install required libraries:
   - Tools > Manage Libraries
   - Search and install:
     - WiFi
     - WebServer
     - ArduinoJson

4. Open `esp32/carwash_controller.ino`

5. Configure WiFi settings:
```cpp
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
```

6. Upload to ESP32:
   - Tools > Board > ESP32 Arduino > ESP32S3 Dev Module
   - Tools > Port > Select your ESP32 port
   - Click Upload

7. Note the IP address from Serial Monitor

8. Update backend `.env` with ESP32 IP:
```env
ESP32_BASE_URL=http://YOUR_ESP32_IP
```

## 5. Stripe Configuration

1. Create a Stripe account at [stripe.com](https://stripe.com)

2. Get your API keys from Dashboard > Developers > API keys

3. Create a webhook endpoint:
   - Dashboard > Developers > Webhooks
   - Add endpoint: `https://your-backend-url.com/api/stripe/webhook`
   - Select events:
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`

4. Copy webhook secret to backend `.env`

5. Create products and prices in Stripe Dashboard for your wash types

## 6. Testing the System

1. **Test ESP32 Connection**:
   - Visit `http://localhost:3000/control`
   - Check if ESP32 shows as "Connected"

2. **Test Relay Control**:
   - Click "Trigger" buttons for each wash type
   - Verify relays activate with 500ms delay

3. **Test Customer Management**:
   - Visit `http://localhost:3000/customers`
   - Add a test customer

4. **Test Wash Types**:
   - Visit `http://localhost:3000/wash-types`
   - Verify default wash types are loaded

## 7. Deployment

### Frontend (Vercel)

1. Push code to GitHub
2. Connect repository to Vercel
3. Configure environment variables in Vercel dashboard
4. Deploy

### Backend (Render)

1. Connect GitHub repository to Render
2. Configure environment variables in Render dashboard
3. Set build command: `cd backend && npm install && npm run build`
4. Set start command: `cd backend && npm start`

### Database (Supabase)

1. Use Supabase production database
2. Update `DATABASE_URL` in backend environment

## Troubleshooting

### ESP32 Not Connecting

1. Check WiFi credentials
2. Verify ESP32 IP address
3. Check firewall settings
4. Test with `ping ESP32_IP`

### Backend API Errors

1. Check database connection
2. Verify environment variables
3. Check logs: `npm run dev`

### Frontend Not Loading

1. Check API URL configuration
2. Verify CORS settings
3. Check browser console for errors

### Relay Not Triggering

1. Check ESP32 IP address
2. Verify relay wiring
3. Check power supply
4. Test with manual button press

## Security Considerations

1. **Change default passwords**
2. **Use HTTPS in production**
3. **Secure ESP32 WiFi network**
4. **Regular security updates**
5. **Monitor system logs**

## Maintenance

1. **Regular ESP32 reboots** (weekly)
2. **Database backups** (daily)
3. **Log monitoring** (daily)
4. **Hardware inspection** (monthly)
5. **Software updates** (monthly)

## Support

For issues and questions:
- Check the logs in each component
- Verify all connections
- Test individual components
- Review this setup guide 