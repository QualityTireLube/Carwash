# Vercel Environment Variable Setup

## Step-by-Step Instructions

### 1. Access Vercel Dashboard
1. Go to [vercel.com](https://vercel.com)
2. Sign in to your account
3. Find and click on your project: **qualitywash**

### 2. Navigate to Environment Variables
1. Click on the **Settings** tab
2. In the left sidebar, click **Environment Variables**

### 3. Add the Environment Variable
1. Click **Add New** button
2. Fill in the following:
   - **Name**: `NEXT_PUBLIC_API_URL`
   - **Value**: `https://carwash-backend-5spn.onrender.com`
   - **Environment**: Select all environments (Production, Preview, Development)
3. Click **Save**

### 4. Redeploy the Project
1. Go to the **Deployments** tab
2. Find your latest deployment
3. Click the three dots menu (⋮)
4. Select **Redeploy**

## Alternative: Using Vercel CLI

If you have Vercel CLI installed:

```bash
# Install Vercel CLI (if not already installed)
npm i -g vercel

# Login to Vercel
vercel login

# Add environment variable
vercel env add NEXT_PUBLIC_API_URL

# When prompted, enter: https://carwash-backend-5spn.onrender.com

# Redeploy
vercel --prod
```

## Verification

After setting the environment variable and redeploying:

1. Visit your site: https://qualitywash.vercel.app
2. Check the browser console for any remaining CORS errors
3. Test the navigation to `/customers` and `/wash-types`

## Troubleshooting

If you still see CORS errors after setting the environment variable:

1. **Wait for deployment**: Environment variable changes require a redeploy
2. **Check the value**: Make sure there are no extra spaces or characters
3. **Clear browser cache**: Hard refresh the page (Ctrl+F5 or Cmd+Shift+R)
4. **Check backend status**: Ensure your backend is running on Render 