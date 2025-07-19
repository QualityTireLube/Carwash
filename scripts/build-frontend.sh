#!/bin/bash
set -e

echo "🚀 Starting frontend build process..."

# Check if frontend directory exists
if [ ! -d "frontend" ]; then
    echo "❌ Error: frontend directory not found"
    ls -la
    exit 1
fi

echo "📁 Found frontend directory, navigating to it..."
cd frontend

echo "📦 Installing dependencies..."
npm install

echo "🔨 Building the application..."
npm run build

echo "✅ Build completed successfully!" 