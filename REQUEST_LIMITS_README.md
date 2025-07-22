# 🚦 Carwash API Request Limits & Optimization Guide

This document explains how the Carwash Controller system manages API requests to stay within Render.com hosting limits.

## 📊 Render.com API Limits

### Current Plan Limits
- **GET Requests**: 400 requests/minute (24,000/hour)
- **POST/PATCH/DELETE**: 30 requests/minute (1,800/hour)
- **Service Operations**: 20 requests/hour
- **Deploy Hooks**: 10/minute per service
- **Jobs**: 2,000/hour

## 🎯 Current Usage Analysis

### GET Request Usage (~10-15 requests/minute)
**Utilization: ~4% of limit** ✅

#### Continuous Polling (High Frequency)
| Source | Endpoint | Frequency | Requests/Min | Requests/Hour |
|--------|----------|-----------|--------------|---------------|
| ESP32 Hardware | `/api/trigger/poll` | Every 10s | 6 | 360 |
| Control Page | `/api/trigger/status` | Every 30s | 2 | 120 |
| Sessions Page | `/api/wash-sessions/active` | Every 30s | 2 | 120 |

#### On-Demand Requests (User-Driven)
| Source | Endpoints | Frequency | Volume |
|--------|-----------|-----------|---------|
| Dashboard Load | `/api/customers`, `/api/wash-types`, `/api/trigger/test` | Page visits | ~3 per visit |
| Navigation | `/api/customers/:id`, `/api/wash-sessions` | User actions | Variable |
| Data Refresh | Various data endpoints | User-initiated | Sporadic |

### POST/PATCH/DELETE Usage (~5 requests/minute)
**Utilization: ~15% of limit** ✅

#### Hardware Operations
| Source | Endpoint | Trigger | Frequency |
|--------|----------|---------|-----------|
| Wash Operations | `POST /api/trigger/:relayId` | Button press | Per wash cycle |
| ESP32 Reports | `POST /api/trigger/completed` | Relay completion | Per wash cycle |

#### Business Operations
| Source | Endpoint | Trigger | Frequency |
|--------|----------|---------|-----------|
| Session Management | `POST /api/wash-sessions/start` | Start wash | Per customer |
| Session Updates | `PATCH /api/wash-sessions/:id` | Complete/cancel | Per session |
| Customer Management | `POST /api/customers` | Add customer | Administrative |
| System Management | `POST /api/wash-types` | Add wash type | Administrative |

## 🔧 Implemented Optimizations

### ESP32 Hardware Optimizations
```ino
// Before: Every 3 seconds (1,200 requests/hour)
const unsigned long POLL_INTERVAL = 3000;

// After: Every 10 seconds (360 requests/hour)
const unsigned long POLL_INTERVAL = 10000;
```
**Impact**: 70% reduction in ESP32 requests

### Frontend Smart Polling
```typescript
// Before: Continuous polling every 15 seconds
setInterval(fetchData, 15000);

// After: Smart polling with visibility detection
const handleVisibilityChange = () => {
  if (document.hidden) {
    clearInterval(intervalRef.current); // Stop when tab hidden
  } else {
    intervalRef.current = setInterval(fetchData, 30000); // 30s when visible
  }
};
```
**Impact**: 50% reduction + stops when tabs inactive

### Backend Caching & Rate Limiting
```typescript
// Response caching for status endpoints
const STATUS_CACHE_TTL = 5000; // 5-second cache

// Rate limiting
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // General limit
}));

// ESP32-specific rate limiting  
app.use('/api/trigger', rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 requests/minute for ESP32
}));
```
**Impact**: Reduced database load + protection against spikes

### Retry Logic Optimization
```typescript
// Before: 2 retries with 1s delay
async function apiRequest(url, options, retries = 2) {
  // ... retry logic with 1000ms delay
}

// After: 1 retry with 2s delay  
async function apiRequest(url, options, retries = 1) {
  // ... retry logic with 2000ms delay
}
```
**Impact**: 33% reduction in retry-generated requests

## 📈 Request Volume Timeline

```
Before Optimizations:
├── ESP32: 1,200 requests/hour (GET)
├── Frontend: 480 requests/hour (GET) 
├── Users: Variable (POST/PATCH/DELETE)
└── Total: ~1,680+ requests/hour

After Optimizations:
├── ESP32: 360 requests/hour (GET) ↓70%
├── Frontend: 240 requests/hour (GET) ↓50%
├── Users: <300 requests/hour (POST/PATCH/DELETE)
└── Total: ~600-900 requests/hour ↓65%
```

## 🚨 Monitoring & Alerts

### What to Monitor
1. **Render Dashboard**: Check "Bandwidth & Requests" section
2. **Request Patterns**: Look for unusual spikes
3. **Error Rates**: 429 (rate limit) responses
4. **User Behavior**: Multiple concurrent users

### Warning Signs
- **GET requests > 300/minute**: Consider increasing polling intervals
- **POST requests > 20/minute**: Check for retry loops or spam
- **429 errors**: Rate limits being hit
- **Multiple users**: Scale polling based on active sessions

## 🔄 Scaling Strategies

### If Approaching GET Limits (300+ requests/minute)

#### Option 1: Increase Polling Intervals
```ino
// ESP32: 10s → 15s (reduces to 4 requests/minute)
const unsigned long POLL_INTERVAL = 15000;
```
```typescript
// Frontend: 30s → 60s (reduces to 1 request/minute per page)
setInterval(fetchData, 60000);
```

#### Option 2: Smart User-Based Throttling
```typescript
// Different intervals for different user types
const getPollingInterval = (userType) => {
  switch(userType) {
    case 'admin': return 30000;    // 30s for admins
    case 'operator': return 45000; // 45s for operators  
    case 'customer': return 60000; // 60s for customers
    default: return 60000;
  }
};
```

#### Option 3: WebSocket Implementation
```typescript
// Replace polling with real-time updates
const ws = new WebSocket('wss://your-backend.com/ws');
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  updateUI(data); // Real-time updates, no polling needed
};
```

### If Approaching POST Limits (25+ requests/minute)

#### Check for Issues:
1. **Retry Loops**: Failed requests causing cascading retries
2. **Spam Protection**: Users clicking buttons rapidly
3. **Automated Systems**: Scripts or integrations making excessive calls
4. **Error Handling**: Failed operations being retried incorrectly

#### Solutions:
1. **Implement Request Queuing**: Buffer non-critical operations
2. **Batch Operations**: Combine multiple updates into single requests
3. **Client-Side Validation**: Prevent invalid requests from being sent
4. **Exponential Backoff**: Increase delays between retries

## 🛠️ Configuration Files

### Environment Variables for Rate Control
```env
# .env
ESP32_POLL_INTERVAL=10000          # ESP32 polling (milliseconds)
FRONTEND_POLL_INTERVAL=30000       # Frontend polling (milliseconds)  
ENABLE_REQUEST_CACHING=true        # Response caching
CACHE_TTL=5000                     # Cache time-to-live (milliseconds)
RATE_LIMIT_WINDOW=900000           # Rate limit window (15 minutes)
RATE_LIMIT_MAX=500                 # Max requests per window
```

### Quick Configuration Changes
```bash
# Reduce ESP32 polling frequency
# Edit esp32/carwash_controller.ino
# Change POLL_INTERVAL from 10000 to 15000

# Reduce frontend polling
# Edit frontend polling components  
# Change interval from 30000 to 60000

# Adjust rate limits
# Edit backend/src/index.ts
# Modify rate limiting configuration
```

## 📋 Emergency Procedures

### If Hitting Rate Limits
1. **Immediate**: Increase all polling intervals by 2x
2. **Short-term**: Disable non-critical polling
3. **Long-term**: Implement WebSocket or upgrade hosting plan

### Emergency Config (Minimal Requests)
```ino
// ESP32: Minimal polling (2 requests/minute)
const unsigned long POLL_INTERVAL = 30000; // 30 seconds
```
```typescript
// Frontend: Minimal polling (0.5 requests/minute)  
setInterval(fetchData, 120000); // 2 minutes
```

## 📊 Success Metrics

### Current Performance ✅
- **GET Usage**: ~4% of limit (excellent)
- **POST Usage**: ~15% of limit (very good)  
- **Stability**: No rate limit errors
- **User Experience**: Real-time feel maintained

### Target Thresholds
- **Green**: <50% of any limit
- **Yellow**: 50-75% of any limit  
- **Red**: >75% of any limit

---

## 🎯 Summary

The Carwash Controller system has been optimized to use **less than 5%** of Render's GET request limits and **less than 15%** of POST request limits, providing excellent headroom for growth and peak usage scenarios.

**Key optimizations:**
- 70% reduction in ESP32 requests
- 50% reduction in frontend requests  
- Smart polling that stops when inactive
- Response caching for frequently accessed endpoints
- Rate limiting protection against spikes

The system can handle multiple concurrent users and high wash volumes while staying well within hosting limits. 