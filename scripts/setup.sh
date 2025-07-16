#!/bin/bash

# Car Wash Controller Setup Script
echo "🚗 Setting up Car Wash Controller..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Create necessary directories
echo "📁 Creating project structure..."
mkdir -p backend/src/{config,middleware,routes,utils,database/migrations}
mkdir -p frontend/src/{app,components,lib,types}
mkdir -p esp32
mkdir -p docs
mkdir -p scripts

# Backend setup
echo "🔧 Setting up backend..."
cd backend

# Install dependencies
echo "📦 Installing backend dependencies..."
npm install

# Create environment file
if [ ! -f .env ]; then
    echo "📝 Creating backend environment file..."
    cp env.example .env
    echo "⚠️  Please configure backend/.env with your settings"
fi

cd ..

# Frontend setup
echo "🔧 Setting up frontend..."
cd frontend

# Install dependencies
echo "📦 Installing frontend dependencies..."
npm install

# Create environment file
if [ ! -f .env.local ]; then
    echo "📝 Creating frontend environment file..."
    cp env.local.example .env.local
    echo "⚠️  Please configure frontend/.env.local with your settings"
fi

cd ..

# Make scripts executable
chmod +x scripts/*.sh

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Configure environment files:"
echo "   - backend/.env"
echo "   - frontend/.env.local"
echo ""
echo "2. Set up your database (PostgreSQL/Supabase)"
echo ""
echo "3. Configure your ESP32:"
echo "   - Update WiFi credentials in esp32/carwash_controller.ino"
echo "   - Upload firmware to your ESP32-S3 board"
echo ""
echo "4. Set up Stripe account and configure webhooks"
echo ""
echo "5. Start development servers:"
echo "   - Backend: cd backend && npm run dev"
echo "   - Frontend: cd frontend && npm run dev"
echo ""
echo "📚 See docs/SETUP.md for detailed instructions" 