# Production Deployment Setup Guide

This guide helps diagnose and fix the API errors you're experiencing in production.

## Current Issues

Based on the error logs, you're experiencing:
1. **500 errors** on `/api/customers` and `/api/wash-types` - Database connection issues
2. **503 errors** on `/api/trigger/test` - ESP32 not reachable (expected in production)
3. **404 errors** - Possible routing issues

## Required Environment Variables

Ensure these environment variables are set in your production environment:

### Essential Variables
```bash
# Database (REQUIRED)
DATABASE_URL=postgresql://username:password@host:port/database_name

# Server Configuration
PORT=3001
NODE_ENV=production

# CORS (Frontend URL)
CORS_ORIGIN=https://your-frontend-domain.vercel.app
```

### Optional Variables
```bash
# Stripe (if using payments)
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# ESP32 (for hardware control)
ESP32_BASE_URL=http://192.168.1.100
ESP32_TIMEOUT=5000

# JWT (if using authentication)
JWT_SECRET=your-super-secret-jwt-key-here
```

## Render.com Setup

If you're using Render.com for hosting:

1. **Database Setup**:
   - Create a PostgreSQL database service
   - Copy the "External Database URL" 
   - Set this as `DATABASE_URL` in your web service environment variables

2. **Environment Variables**:
   - Go to your web service settings
   - Add all required environment variables
   - Make sure `DATABASE_URL` exactly matches your database connection string

3. **Build Settings**:
   ```bash
   Build Command: npm run build
   Start Command: npm start
   ```

## Vercel Setup (if using Vercel)

For Vercel deployment:

1. **Database**: Use a cloud PostgreSQL service (like Render, Railway, or Supabase)
2. **Environment Variables**: Add them in your Vercel project settings
3. **Build Configuration**: Ensure your `vercel.json` includes proper API routing

## Debugging Steps

### Step 1: Check Health Endpoint
Visit: `https://your-backend-url.com/health`

Expected response:
```json
{
  "status": "OK",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "environment": "production",
  "database": "connected",
  "version": "1.0.0"
}
```

If `database: "disconnected"`, your DATABASE_URL is incorrect.

### Step 2: Check Database Connection String Format
Your DATABASE_URL should look like:
```
postgresql://username:password@hostname:port/database_name
```

### Step 3: Test Individual Endpoints
1. Test: `GET /api/customers` (should return `{"customers": []}` if empty)
2. Test: `GET /api/wash-types` (should return `{"washTypes": []}` if empty)
3. Test: `GET /api/trigger/test` (503 error is expected without ESP32)

### Step 4: Check Logs
In your hosting platform, check the application logs for:
- Database connection errors
- Migration failures
- Missing environment variables

## Common Issues & Solutions

### Issue: "DATABASE_URL environment variable is required"
**Solution**: Set the DATABASE_URL in your hosting platform's environment variables.

### Issue: "Database connection failed"
**Solution**: 
- Verify the DATABASE_URL format
- Ensure the database server is accessible
- Check firewall settings

### Issue: "Migration failed"
**Solution**: 
- Connect to your database manually
- Run the SQL from `backend/src/database/migrations/001_initial_schema.sql`
- Or run: `npm run migrate` if your hosting platform supports it

### Issue: "Route not found" (404 errors)
**Solution**:
- Ensure your hosting platform serves the backend at the correct path
- Check your CORS configuration includes your frontend domain

## Database Schema Setup

If you need to manually set up the database, run this SQL:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create tables
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    rfid_tag VARCHAR(100) UNIQUE,
    membership_status VARCHAR(20) DEFAULT 'inactive' CHECK (membership_status IN ('active', 'inactive', 'pending')),
    stripe_customer_id VARCHAR(255) UNIQUE,
    stripe_subscription_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wash_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    duration INTEGER NOT NULL CHECK (duration > 0),
    price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    relay_id INTEGER NOT NULL CHECK (relay_id >= 1 AND relay_id <= 4),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_membership_status ON customers(membership_status);
CREATE INDEX IF NOT EXISTS idx_wash_types_relay_id ON wash_types(relay_id);
CREATE INDEX IF NOT EXISTS idx_wash_types_active ON wash_types(is_active);
```

## Next Steps

1. Set the `DATABASE_URL` environment variable in your production environment
2. Redeploy your backend service
3. Test the `/health` endpoint to verify database connection
4. Test the API endpoints to ensure they work correctly

The ESP32 503 errors are expected in production since the hardware isn't connected to the cloud environment. 