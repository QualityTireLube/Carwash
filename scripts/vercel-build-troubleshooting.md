# Vercel Build Troubleshooting Guide

## Issue: "Command 'cd frontend && npm install' exited with 1"

### ✅ **Fixed: Duplicate npm install**
The issue was caused by having `npm install` in both `installCommand` and `buildCommand`. This has been fixed.

### 🔍 **Common Causes & Solutions**

#### 1. **Node.js Version Issues**
If you still get build errors, check your Node.js version:

```json
// Add to frontend/package.json
{
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=8.0.0"
  }
}
```

#### 2. **Memory Issues**
If the build fails due to memory, try:

```json
// Add to vercel.json
{
  "functions": {
    "app/**/*.ts": {
      "maxDuration": 30
    }
  }
}
```

#### 3. **TypeScript Errors**
If TypeScript compilation fails:

```bash
# Test locally first
cd frontend
npm run type-check
```

#### 4. **Missing Dependencies**
If dependencies are missing:

```bash
# Check for missing packages
cd frontend
npm ls --depth=0
```

### 🚀 **Current Configuration**

Your `vercel.json` is now correctly configured:

```json
{
  "buildCommand": "cd frontend && npm run build",
  "installCommand": "cd frontend && npm install",
  "outputDirectory": "frontend/.next",
  "framework": "nextjs"
}
```

### 📋 **Next Steps**

1. **Wait for Vercel to redeploy** (should happen automatically)
2. **Check the build logs** in Vercel dashboard
3. **If it still fails**, check the specific error message in the logs

### 🔧 **Manual Redeploy**

If you need to force a redeploy:

1. Go to Vercel dashboard
2. Select your project
3. Go to Deployments tab
4. Click "Redeploy" on the latest deployment

### 📞 **If Issues Persist**

1. Check the full build log in Vercel dashboard
2. Look for specific error messages
3. Test the build locally: `cd frontend && npm run build`
4. Check if all dependencies are properly listed in `package.json` 