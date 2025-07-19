#!/bin/bash

echo "🔧 Setting up database..."

# Navigate to backend directory
cd backend

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Run manual migrations
echo "🗄️ Running database migrations..."
npm run migrate:manual

echo "✅ Database setup complete!" 