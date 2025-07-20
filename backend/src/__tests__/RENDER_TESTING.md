# Running Integration Tests on Render

This guide explains how to run integration tests on Render's cloud platform with multiple deployment strategies.

## 🏗️ Setup Options

### Option 1: Pre-Deployment Testing (Recommended)

This approach runs tests during the build process before deploying to production.

#### Configuration

Your `render.yaml` is configured to:
1. Create a separate test database service
2. Run tests during the build process
3. Only deploy if tests pass

```yaml
services:
  # Test Database Service
  - type: pgsql
    name: carwash-test-db
    databaseName: carwash_test
    user: testuser
    plan: starter

  # Production Database Service  
  - type: pgsql
    name: carwash-db
    databaseName: carwash_db
    user: carwashuser
    plan: starter

  # Backend Web Service
  - type: web
    name: carwash-backend
    buildCommand: cd backend && npm install && npm run test:ci && npm run build
    envVars:
      - key: TEST_DATABASE_URL
        fromDatabase:
          name: carwash-test-db
          property: connectionString
```

#### Environment Variables

Required in your Render service:
- `TEST_DATABASE_URL` - Automatically set from test database
- `DATABASE_URL` - Automatically set from production database
- `JWT_SECRET` - Set manually
- `STRIPE_SECRET_KEY` - Set manually (test keys recommended)

### Option 2: Separate Test Environment

Create a completely separate test environment that mirrors production.

#### Render Dashboard Setup

1. **Create Test Web Service**:
   ```
   Name: carwash-backend-test
   Build Command: cd backend && npm install && npm run test && npm run build
   Start Command: cd backend && npm start
   ```

2. **Create Test Database**:
   ```
   Name: carwash-test-db
   Database: carwash_test
   User: testuser
   ```

3. **Environment Variables**:
   ```
   NODE_ENV=test
   DATABASE_URL=<from test database>
   JWT_SECRET=test-jwt-secret
   STRIPE_SECRET_KEY=sk_test_...
   ESP32_BASE_URL=http://localhost:8080
   ```

### Option 3: Post-Deployment Testing

Run tests against your live production environment.

#### GitHub Actions Workflow

Create `.github/workflows/test-production.yml`:

```yaml
name: Production Tests
on:
  deployment_status:
    types: [success]

jobs:
  test:
    if: github.event.deployment_status.state == 'success'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: cd backend && npm install
      - name: Run integration tests
        env:
          DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
          JWT_SECRET: ${{ secrets.TEST_JWT_SECRET }}
        run: cd backend && npm run test:integration
```

## 🚀 Deployment Process

### Automatic Testing (Option 1)

1. **Push to main branch**
2. **Render automatically**:
   - Pulls latest code
   - Installs dependencies
   - **Runs integration tests**
   - If tests pass → builds and deploys
   - If tests fail → stops deployment

3. **Monitor in Render Dashboard**:
   - Go to your service
   - Check "Events" tab for build logs
   - Look for test results in build output

### Manual Testing Commands

```bash
# Local development
npm run test:integration

# Render CI environment simulation
NODE_ENV=test DATABASE_URL=$TEST_DATABASE_URL npm run test:ci

# With coverage
npm run test:coverage

# Watch mode (local only)
npm run test:watch
```

## 🎛️ Render Dashboard Configuration

### 1. Create Services

#### Test Database
```
Service Type: PostgreSQL
Name: carwash-test-db
Database Name: carwash_test
User: testuser
Plan: Starter (or Free for testing)
```

#### Production Database  
```
Service Type: PostgreSQL
Name: carwash-db
Database Name: carwash_db
User: carwashuser
Plan: Starter+
```

#### Web Service
```
Service Type: Web Service
Name: carwash-backend
Repository: <your-github-repo>
Branch: main
Build Command: cd backend && npm install && npm run test:ci && npm run build
Start Command: cd backend && npm start
```

### 2. Environment Variables

Set in your web service:

| Variable | Value | Source |
|----------|-------|---------|
| `NODE_ENV` | `production` | Manual |
| `DATABASE_URL` | `<connection-string>` | From carwash-db |
| `TEST_DATABASE_URL` | `<connection-string>` | From carwash-test-db |
| `JWT_SECRET` | `<your-secret>` | Manual |
| `STRIPE_SECRET_KEY` | `sk_test_...` | Manual |
| `CORS_ORIGIN` | `https://your-frontend.vercel.app` | Manual |

## 📊 Monitoring & Debugging

### Build Logs

1. Go to Render Dashboard
2. Select your service
3. Click "Events" tab
4. Look for test output in build logs:

```
✓ Should create customer with all required fields
✓ Should return 400 when name is missing
✓ Should handle duplicate email addresses
✓ All tests passed (23 tests, 0 failures)
```

### Test Failures

If tests fail during deployment:

1. **Check build logs** for specific test failures
2. **Database connection issues**:
   ```
   Error: Database connection failed
   ```
   - Verify `TEST_DATABASE_URL` is set correctly
   - Check database service is running

3. **Timeout issues**:
   ```
   Test timeout exceeded (60000ms)
   ```
   - Database might be slow to respond
   - Increase timeout in Jest config

4. **Environment issues**:
   ```
   Error: JWT_SECRET is required
   ```
   - Verify all environment variables are set

### Debug Mode

Add debug environment variable to see detailed logs:

```
DEBUG=*
```

## 🔧 Troubleshooting

### Common Issues

#### 1. Tests Pass Locally But Fail on Render

**Possible Causes**:
- Environment variable differences
- Database connection string format
- SSL requirements in production

**Solutions**:
```bash
# Test with production-like environment locally
NODE_ENV=production DATABASE_URL="<render-test-db-url>" npm run test:ci
```

#### 2. Database Connection Timeout

**Error**: `Connection timeout`

**Solutions**:
- Increase Jest timeout in config
- Check database plan limits
- Verify database is in same region as web service

#### 3. Build Command Fails

**Error**: `npm run test:ci: command not found`

**Solution**: Ensure `test:ci` script exists in `package.json`:
```json
{
  "scripts": {
    "test:ci": "NODE_ENV=test DATABASE_URL=$TEST_DATABASE_URL jest --testPathPattern=integration --verbose --forceExit"
  }
}
```

#### 4. Memory/Resource Limits

**Error**: `Process killed (out of memory)`

**Solutions**:
- Upgrade to higher Render plan
- Reduce test parallelization:
  ```javascript
  // jest.config.js
  maxWorkers: 1
  ```

### Performance Optimization

1. **Use Starter+ Database Plan** for better performance
2. **Set maxWorkers to 1** in CI environment
3. **Use connection pooling** (already configured)
4. **Clear data instead of recreating** database

## 🔄 Alternative Approaches

### 1. Skip Tests in Production Builds

Modify `render.yaml` to skip tests:
```yaml
buildCommand: cd backend && npm install && npm run build
```

Then run tests separately via:
- GitHub Actions
- Render Cron Jobs
- Manual triggers

### 2. Conditional Testing

Only run tests on specific branches:
```yaml
buildCommand: |
  cd backend && npm install && \
  if [ "$RENDER_GIT_BRANCH" = "main" ]; then npm run test:ci; fi && \
  npm run build
```

### 3. External Test Database

Use external services like:
- **Supabase** - Free PostgreSQL with good performance
- **Railway** - Simple PostgreSQL hosting
- **ElephantSQL** - Managed PostgreSQL

## 📈 Best Practices

1. **Use separate test database** - Never test against production data
2. **Test on every deployment** - Catch issues before they reach users
3. **Monitor test performance** - Optimize slow tests
4. **Use descriptive test names** - Easy to identify failures in logs
5. **Clean up test data** - Prevent database bloat
6. **Set appropriate timeouts** - Account for network latency
7. **Use test-specific configurations** - Different settings for CI

## 🎯 Next Steps

1. **Deploy the updated configuration**:
   ```bash
   git add .
   git commit -m "Add Render integration testing"
   git push origin main
   ```

2. **Monitor the first deployment** in Render dashboard

3. **Check test results** in build logs

4. **Iterate and improve** based on results

Your tests will now run automatically on every deployment to Render, ensuring your carwash application is always working correctly in production! 🚗✨ 