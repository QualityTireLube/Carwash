# Car Wash Backend API

A robust Express.js backend API for managing car wash operations with hybrid ESP32 communication.

## 🚀 Overview

The backend provides:
- **REST API** for customer and wash management
- **Hybrid ESP32 Communication** (direct calls + polling)
- **Stripe Integration** for payment processing
- **PostgreSQL Database** operations
- **Real-time Relay Control** with spam protection

## 🔧 Hybrid ESP32 Communication System

This backend implements a sophisticated dual-mode communication system with the ESP32:

### **Architecture Overview**

#### **1. Polling System (Background Operations)**
- **Frequency**: Every 1 second
- **Purpose**: RFID detection, background commands, system monitoring
- **Endpoint**: `GET /api/trigger/poll`
- **Rate Limit**: 80 requests/minute (33% buffer for 60 req/min)
- **Timeout**: ESP32 considered offline after 5 seconds (5 missed polls)

#### **2. Direct HTTP Calls (Frontend Operations)**  
- **Latency**: ~100ms response time
- **Purpose**: Instant manual wash triggers from admin panel
- **Method**: Backend makes direct `axios.post()` to ESP32's local IP
- **Endpoint**: `http://{esp32-ip}/trigger`
- **Fallback**: Commands automatically queued if direct call fails

### Communication Flow

```mermaid
graph TD
    A[Frontend Trigger] --> B[Backend API]
    B --> C{ESP32 Reachable?}
    C -->|Yes| D[Direct HTTP Call]
    C -->|No| E[Queue Command]
    D --> F[Immediate Response ⚡]
    E --> G[ESP32 Polls Every 10s]
    G --> H[Command Executed]
    
    I[RFID Scan] --> E
    J[Background Task] --> E
```

## 📡 API Endpoints

### Relay Control (Hybrid System)

#### **POST** `/api/trigger/:relayId`
Triggers a relay using the hybrid system.

**Request:**
```http
POST /api/trigger/3
Content-Type: application/json
```

**Response (Direct Call Success):**
```json
{
  "success": true,
  "message": "Relay 3 triggered directly",
  "method": "direct",
  "relayId": 3,
  "commandId": "cmd_123",
  "timestamp": "2025-07-22T14:30:00.000Z"
}
```

**Response (Polling Fallback):**
```json
{
  "success": true,
  "message": "Relay 3 command queued (polling fallback)",
  "method": "polling", 
  "relayId": 3,
  "commandId": "cmd_124",
  "timestamp": "2025-07-22T14:30:00.000Z"
}
```

### ESP32 Status & Monitoring

#### **GET** `/api/trigger/status`
Get current ESP32 connection status.

**Response:**
```json
{
  "success": true,
  "status": {
    "system": "online",
    "lastPollTime": 1753194077955,
    "timeSinceLastPoll": 3143,
    "pollingActive": true
  },
  "timestamp": "2025-07-22T14:30:00.000Z"
}
```

#### **GET** `/api/trigger/queue`
Debug endpoint showing detailed ESP32 connectivity and queue status.

**Response:**
```json
{
  "success": true,
  "esp32Online": true,
  "lastPollTime": 1753194077955,
  "timeSinceLastPoll": 3143,
  "lastKnownIP": "192.168.1.100",
  "directCallsEnabled": true,
  "pollingInterval": "10 seconds",
  "pendingCommands": 0,
  "commands": [],
  "spamProtection": [],
  "timestamp": "2025-07-22T14:30:00.000Z"
}
```

#### **GET** `/api/trigger/poll`
ESP32 polling endpoint (used by ESP32 device).

**Response (Command Available):**
```json
{
  "hasCommand": true,
  "command": {
    "id": "cmd_123",
    "relayId": 2,
    "source": "rfid",
    "timestamp": 1753194077955
  }
}
```

**Response (No Commands):**
```json
{
  "hasCommand": false,
  "message": "No pending commands"
}
```

### Customer Management

#### **GET** `/api/customers`
List all customers with pagination.

#### **POST** `/api/customers`
Create a new customer.

#### **GET** `/api/customers/:id`
Get customer details including memberships.

#### **PUT** `/api/customers/:id`
Update customer information.

#### **DELETE** `/api/customers/:id`
Delete customer and associated data.

### Wash Types Management

#### **GET** `/api/wash-types`
List all wash types.

#### **POST** `/api/wash-types`
Create a new wash type.

#### **PUT** `/api/wash-types/:id`
Update wash type configuration.

#### **DELETE** `/api/wash-types/:id`
Delete wash type.

### Stripe Integration

#### **POST** `/api/stripe/webhook`
Handle Stripe webhook events.

#### **POST** `/api/stripe/create-subscription`
Create customer subscription.

#### **POST** `/api/stripe/cancel-subscription`
Cancel customer subscription.

## ⚙️ Configuration

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/carwash_db

# JWT Authentication  
JWT_SECRET=your-super-secret-jwt-key

# Stripe Payment Processing
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Server Configuration
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
```

### Rate Limiting

#### ESP32 Polling Protection
- **Limit**: 15 requests per minute
- **Window**: 60 seconds
- **Applies to**: `/api/trigger/poll` endpoint only

#### General API Protection  
- **Limit**: 500 requests per 15 minutes
- **Window**: 15 minutes
- **Applies to**: All other endpoints

### Database Connection Pool
- **Max Connections**: 10
- **Idle Timeout**: 60 seconds
- **Connection Timeout**: 5 seconds

## 🛡️ Error Handling

### ESP32 Communication Errors

#### Direct Call Failures
- **Timeout**: 2 seconds
- **Fallback**: Automatic queuing for polling
- **Logging**: Warning level with error details

#### Polling System
- **ESP32 Offline Detection**: 25 seconds without poll
- **Command Queuing**: Persistent until executed
- **Spam Protection**: 2-second cooldown per relay

### API Error Responses

#### **400 Bad Request**
```json
{
  "error": "Invalid relay ID. Must be between 1 and 6.",
  "relayId": 7
}
```

#### **429 Too Many Requests**
```json
{
  "error": "Please wait 1 seconds before triggering relay 3 again",
  "relayId": 3
}
```

#### **503 Service Unavailable**
```json
{
  "success": false,
  "message": "ESP32 not reachable",
  "status": {
    "system": "offline",
    "lastPollTime": 1753194077955,
    "timeSinceLastPoll": 45000
  }
}
```

## 📊 Performance & Monitoring

### Request Volume (Per Hour)
- **ESP32 Polling**: ~360 requests
- **Direct ESP32 Calls**: ~50-100 requests  
- **Frontend API Calls**: ~240 requests
- **Total Estimated**: ~650-900 requests

### Response Times
- **Direct ESP32 Calls**: ~100ms
- **Database Queries**: <50ms (cached)
- **Polling Responses**: <10ms
- **API Endpoints**: <100ms

### Caching Strategy
- **Status Endpoints**: 5-second cache
- **Database Queries**: Connection pooling
- **ESP32 IP Tracking**: In-memory storage

## 🚀 Deployment

### Build & Start
```bash
npm install
npm run build
npm start
```

### Health Checks
```bash
# API Health
curl http://localhost:3001/api/test/db

# ESP32 Status
curl http://localhost:3001/api/trigger/status

# Queue Debug Info
curl http://localhost:3001/api/trigger/queue
```

### Monitoring Endpoints
- `/api/test/db` - Database connectivity
- `/api/trigger/status` - ESP32 status
- `/api/trigger/queue` - Detailed debug info

## 🔧 Development

### Running Tests
```bash
npm test                    # Run all tests
npm run test:integration   # Integration tests only
npm run test:watch         # Watch mode
```

### Database Migrations
```bash
npm run migrate            # Run pending migrations
npm run add-test-data      # Add sample data
```

### Debugging
```bash
NODE_ENV=development npm run dev
```

Enable debug logging:
```bash
DEBUG=carwash:* npm run dev
```

## 📈 Optimization Features

### Request Efficiency
- **50% fewer ESP32 polls** (10s vs 3s intervals)
- **Smart caching** reduces database load
- **Connection pooling** optimizes database usage

### User Experience  
- **30x faster frontend response** (3000ms → 100ms)
- **Instant manual triggers** via direct calls
- **Reliable background processing** via polling

### System Reliability
- **Automatic fallback** system prevents lost commands
- **Spam protection** prevents relay damage  
- **Error recovery** handles network issues gracefully

---

## 🔍 Quick Debug Commands

```bash
# Check ESP32 connectivity
curl https://your-backend.com/api/trigger/queue

# Test direct relay trigger
curl -X POST https://your-backend.com/api/trigger/1

# Monitor ESP32 polls
tail -f logs/app.log | grep "ESP32 polling"
```
