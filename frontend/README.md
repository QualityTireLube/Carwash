# Car Wash Controller Frontend

A modern Next.js frontend for the Car Wash Controller application with real-time ESP32 connectivity monitoring.

## 🚀 Features

- **Real-time ESP32 Status Monitoring** with auto-refresh capabilities
- **Instant Wash Triggers** via hybrid backend communication (~100ms response)
- **Smart Connectivity Diagnostics** with detailed debug tools
- **ESP32 Bypass Mode** for development and testing
- **Responsive Design** with TailwindCSS
- **TypeScript** for type safety

## 📡 ESP32 Integration

The frontend automatically benefits from the **hybrid ESP32 communication system**:

- **Instant Manual Triggers**: ~100ms response time (30x faster than before)
- **Continuous Status Monitoring**: 15-30 second intervals with smart caching
- **Auto-Recovery**: Automatically reconnects when ESP32 comes online
- **Fallback Support**: Works with both direct calls and polling systems

## Development

```bash
npm install
npm run dev
```

## Environment Variables

Create a `.env.local` file with:

```
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
```

## Build

```bash
npm run build
npm start
```

## Deployment

This frontend is designed to be deployed on Vercel. The root `vercel.json` file contains the necessary configuration to build from the `frontend/` directory. 