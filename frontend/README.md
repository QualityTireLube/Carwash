# Car Wash Controller Frontend

This is the Next.js frontend for the Car Wash Controller application.

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