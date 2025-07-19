# Deployment Setup Guide

## Frontend (Vercel) Environment Variables

You need to set the following environment variables in your Vercel project:

1. Go to your Vercel dashboard
2. Select your project (qualitywash)
3. Go to Settings > Environment Variables
4. Add the following variable:

```
NEXT_PUBLIC_API_URL=https://carwash-backend-5spn.onrender.com
```

## Backend (Render) Environment Variables

You need to update the CORS configuration in your backend. The backend should already be configured to allow requests from your Vercel domain.

If you need to update the backend environment variables in Render:

1. Go to your Render dashboard
2. Select your backend service
3. Go to Environment
4. Update or add:

```
CORS_ORIGIN=https://qualitywash.vercel.app
```

## Testing the Fix

After setting the environment variables:

1. Redeploy your frontend on Vercel
2. Test the following URLs:
   - https://qualitywash.vercel.app/customers
   - https://qualitywash.vercel.app/customers/new
   - https://qualitywash.vercel.app/wash-types
   - https://qualitywash.vercel.app/wash-types/new

## Troubleshooting

If you still see CORS errors:

1. Check that the backend CORS configuration includes your Vercel domain
2. Verify the API URL is correct in your frontend environment variables
3. Make sure your backend is running and accessible

## Local Development

For local development, use:

```
NEXT_PUBLIC_API_URL=http://localhost:3001
``` 