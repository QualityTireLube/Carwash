#!/bin/bash

echo "🚗 Setting up Render Integration Testing..."
echo ""

# Check if we're in the right directory
if [ ! -f "render.yaml" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Check if git is available
if ! command -v git &> /dev/null; then
    echo "❌ Error: Git is not installed"
    exit 1
fi

echo "📋 Configuration Summary:"
echo "✓ render.yaml updated with test database service"
echo "✓ package.json updated with test:ci script"
echo "✓ Jest config optimized for CI environment"
echo "✓ Test setup handles managed database environments"
echo ""

echo "🔧 Next Steps for Render Dashboard:"
echo ""
echo "1. Create Test Database Service:"
echo "   - Service Type: PostgreSQL"
echo "   - Name: carwash-test-db"
echo "   - Database: carwash_test"
echo "   - User: testuser"
echo "   - Plan: Starter (or Free)"
echo ""

echo "2. Create/Update Production Database Service:"
echo "   - Service Type: PostgreSQL"
echo "   - Name: carwash-db"
echo "   - Database: carwash_db"
echo "   - User: carwashuser"
echo "   - Plan: Starter+"
echo ""

echo "3. Update Web Service Environment Variables:"
echo "   - TEST_DATABASE_URL: (auto-linked from carwash-test-db)"
echo "   - DATABASE_URL: (auto-linked from carwash-db)"
echo "   - JWT_SECRET: your-secret-key"
echo "   - STRIPE_SECRET_KEY: sk_test_..."
echo "   - CORS_ORIGIN: https://your-frontend.vercel.app"
echo ""

echo "4. Update Build Command in Web Service:"
echo "   cd backend && npm install && npm run test:ci && npm run build"
echo ""

# Ask user if they want to commit and push
read -p "Do you want to commit and push these changes to trigger deployment? (y/N): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "📝 Committing changes..."
    git add .
    git commit -m "feat: Add Render integration testing configuration

- Add test database service to render.yaml
- Add test:ci script for CI environment
- Update Jest config for better CI compatibility
- Add comprehensive Render testing documentation
- Support both local and managed database environments"

    echo "📤 Pushing to repository..."
    git push

    echo ""
    echo "🚀 Changes pushed! Render will now:"
    echo "1. Create the test database service (if configured)"
    echo "2. Run integration tests during build"
    echo "3. Only deploy if tests pass"
    echo ""
    echo "📊 Monitor deployment at: https://dashboard.render.com"
    echo ""
    echo "🔍 Check build logs for test output:"
    echo "   Go to your service → Events tab → Latest build"
    
else
    echo ""
    echo "⏸️  Changes not committed. You can commit manually later:"
    echo "   git add ."
    echo "   git commit -m \"Add Render integration testing\""
    echo "   git push"
fi

echo ""
echo "📚 For detailed setup instructions, see:"
echo "   backend/src/__tests__/RENDER_TESTING.md"
echo ""
echo "🎯 Test commands:"
echo "   npm run test:integration  # Local testing"
echo "   npm run test:ci          # CI environment simulation"
echo "   npm run test:coverage    # With coverage report"
echo ""
echo "✅ Render integration testing setup complete!" 