# Setting up Vercel Environment Variables

## Issue
Your frontend is deployed on Vercel but getting a 404 error because it's trying to make API calls to `localhost:3001` which doesn't exist in production.

## Solution
You need to set the `NEXT_PUBLIC_API_URL` environment variable in your Vercel project.

## Steps to Fix

### Option 1: Via Vercel Dashboard (Recommended)
1. Go to [vercel.com](https://vercel.com) and log in
2. Find your "Carwash" project
3. Go to Settings → Environment Variables
4. Add a new environment variable:
   - **Name**: `NEXT_PUBLIC_API_URL`
   - **Value**: Your backend URL (e.g., `https://carwash-backend-xxxxx.onrender.com`)
   - **Environment**: Production (and Preview if you want)
5. Save and redeploy

### Option 2: Via Vercel CLI
1. Make sure you're in the project directory
2. Run: `vercel env add NEXT_PUBLIC_API_URL`
3. Enter your backend URL when prompted
4. Redeploy: `vercel --prod`

## Backend URL
You need to find your actual backend URL. Based on your `render.yaml`, it should be something like:
`https://carwash-backend-xxxxx.onrender.com`

You can find this URL in your Render dashboard.

## After Setting the Environment Variable
1. The frontend will be able to make API calls to your backend
2. The dashboard will show real data instead of zeros
3. The wash controls will work properly

## Testing
After setting the environment variable and redeploying, visit your Vercel URL again. The 404 error should be resolved and you should see your car wash dashboard. 