# Integration Tests

This directory contains integration tests for the Carwash Backend API.

## Setup

### 1. Install Dependencies

First, install the required testing dependencies:

```bash
cd backend
npm install
```

### 2. Database Setup

You need a PostgreSQL database for testing. The tests use a separate test database to avoid interfering with your development data.

#### Option A: Local PostgreSQL
1. Ensure PostgreSQL is installed and running
2. Create a test database:
   ```sql
   CREATE DATABASE carwash_test;
   ```

#### Option B: Docker PostgreSQL
```bash
docker run --name postgres-test -e POSTGRES_PASSWORD=password -e POSTGRES_DB=carwash_test -p 5433:5432 -d postgres:14
```

### 3. Environment Variables

Create a `.env.test` file in the backend directory with:

```bash
# Test Environment Variables
NODE_ENV=test
DATABASE_URL=postgresql://postgres:password@localhost:5432/carwash_test
JWT_SECRET=test-jwt-secret-key-for-testing
STRIPE_SECRET_KEY=sk_test_dummy_key_for_testing
ESP32_HOST=http://localhost:8080
PORT=3001
CORS_ORIGIN=http://localhost:3000
CLEANUP_TEST_DB=false
```

**Note:** Update the `DATABASE_URL` to match your PostgreSQL setup.

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Only Integration Tests
```bash
npm run test:integration
```

### Run Tests in Watch Mode
```bash
npm run test:watch
```

### Run Tests with Coverage
```bash
npm run test:coverage
```

## Test Structure

### Customer Creation Integration Tests

Located in `./integration/customers.test.ts`, these tests cover:

#### Success Scenarios
- ✅ Create customer with all required fields
- ✅ Create customer with minimal required fields only
- ✅ Create customer with all optional fields
- ✅ Create multiple customers with different emails
- ✅ Verify data persistence in database

#### Validation Error Scenarios
- ❌ Missing name field
- ❌ Empty/whitespace-only name
- ❌ Missing email field
- ❌ Invalid email format
- ❌ Invalid membership status
- ❌ Invalid phone number format
- ❌ Multiple validation errors

#### Database Constraint Scenarios
- ❌ Duplicate email addresses
- ❌ Duplicate RFID tags

#### Edge Cases
- ✅ Very long names (255 characters)
- ✅ Name trimming and special characters
- ✅ Optional fields (phone, RFID)
- ✅ All valid membership statuses

## Test Database Management

The test suite automatically:
1. Creates a test database (if it doesn't exist)
2. Sets up all required tables and indexes
3. Clears all data between tests
4. Optionally drops the test database after completion

### Manual Database Reset

If you need to manually reset the test database:

```bash
# Connect to PostgreSQL
psql -U postgres

# Drop and recreate test database
DROP DATABASE IF EXISTS carwash_test;
CREATE DATABASE carwash_test;
```

## Configuration

### Jest Configuration

The Jest configuration is in `jest.config.js`:
- Uses `ts-jest` for TypeScript support
- 30-second timeout for database operations
- Global setup/teardown for database management
- Coverage collection from all source files

### Test Utilities

Located in `./helpers/testUtils.ts`:
- `TestDatabase`: Database management utilities
- `ApiTestHelper`: HTTP request helpers
- Test data generators and interfaces

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Verify PostgreSQL is running
   - Check `DATABASE_URL` in `.env.test`
   - Ensure test database exists

2. **Permission Errors**
   - Verify PostgreSQL user has CREATE/DROP privileges
   - Check database user credentials

3. **Port Conflicts**
   - If using Docker, ensure port 5433 is available
   - Update `DATABASE_URL` port if needed

4. **Timeout Errors**
   - Tests have 30-second timeout
   - Check database performance
   - Verify network connectivity

### Debug Mode

To run tests with detailed output:
```bash
DEBUG=* npm test
```

### Keeping Test Database

To preserve the test database for debugging:
```bash
CLEANUP_TEST_DB=false npm test
```

## Contributing

When adding new tests:
1. Use the existing test structure and utilities
2. Clear data between tests using `TestDatabase.clearAllTables()`
3. Follow the naming convention: `describe` for features, `it` for specific scenarios
4. Include both success and failure cases
5. Test edge cases and boundary conditions

### Test Categories

- **Unit Tests**: Test individual functions (future)
- **Integration Tests**: Test API endpoints with database
- **E2E Tests**: Test complete user workflows (future)

## Performance

The test suite is optimized for speed:
- Database setup happens once globally
- Data clearing (not recreation) between tests
- Parallel test execution where possible
- Minimal data fixtures

Current test suite typically runs in under 30 seconds. 