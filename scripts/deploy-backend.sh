#!/bin/bash

echo "🚀 Deploying backend changes to Render..."

# Check if we're in the right directory
if [ ! -f "backend/package.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Check if git is available
if ! command -v git &> /dev/null; then
    echo "❌ Error: Git is not installed"
    exit 1
fi

echo "📝 Committing backend changes..."
git add backend/src/index.ts
git commit -m "fix: update CORS configuration to allow Vercel domain"

echo "📤 Pushing to remote repository..."
git push

echo "✅ Backend changes pushed to repository"
echo ""
echo "🔄 Render will automatically deploy the changes"
echo "⏳ This usually takes 2-5 minutes"
echo ""
echo "📋 Next steps:"
echo "1. Wait for Render deployment to complete"
echo "2. Set environment variable in Vercel: NEXT_PUBLIC_API_URL=https://carwash-backend-5spn.onrender.com"
echo "3. Redeploy frontend on Vercel"
echo ""
echo "🔍 You can monitor the deployment at: https://dashboard.render.com" 