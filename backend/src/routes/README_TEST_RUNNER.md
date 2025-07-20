# Test Runner API Documentation

This API provides endpoints to execute integration tests from the frontend and get real-time results.

## 🎯 Overview

The Test Runner system allows you to:
- Run all integration tests
- Run specific test suites
- Run individual tests
- Get real-time test results with detailed output
- Monitor test progress and status

## 📡 API Endpoints

### Get Available Test Suites
```
GET /api/test-runner/suites
```

**Response:**
```json
{
  "success": true,
  "suites": [
    {
      "id": "customer-creation",
      "name": "Customer Creation Tests",
      "description": "Tests for creating, validating, and managing customers",
      "testCount": 21
    }
  ],
  "totalTests": 21
}
```

### Run All Tests
```
POST /api/test-runner/run-all
```

**Response:**
```json
{
  "success": true,
  "numPassedTests": 21,
  "numFailedTests": 0,
  "numTotalTests": 21,
  "testResults": [...],
  "rawOutput": "...",
  "error": null,
  "executionTime": 5230
}
```

### Run Test Suite
```
POST /api/test-runner/run-suite/:suiteId
```

**Parameters:**
- `suiteId`: ID of the test suite to run

**Response:** Same format as run-all

### Run Specific Test
```
POST /api/test-runner/run-test
```

**Body:**
```json
{
  "testName": "should create a customer with all required fields",
  "suiteId": "customer-creation"
}
```

**Response:** Same format as run-all

## 🔧 Configuration

### Adding New Test Suites

To add a new test suite, update the `TEST_SUITES` object in `testRunner.ts`:

```typescript
const TEST_SUITES = {
  'customer-creation': {
    name: 'Customer Creation Tests',
    description: 'Tests for creating, validating, and managing customers',
    file: 'customers.test.ts',
    tests: [
      'should create a customer with all required fields',
      // ... more tests
    ]
  },
  'new-suite': {
    name: 'New Feature Tests',
    description: 'Tests for new feature functionality',
    file: 'newFeature.test.ts',
    tests: [
      'should do something',
      'should handle edge cases',
      // ... more tests
    ]
  }
};
```

### Test File Requirements

Test files must be:
1. Located in `src/__tests__/integration/`
2. Named with `.test.ts` extension
3. Use Jest testing framework
4. Export proper test results

## 🏃‍♂️ How It Works

### Test Execution Process

1. **Request Received**: API endpoint receives test execution request
2. **Jest Spawned**: New Jest process is spawned with specific parameters
3. **Output Captured**: Both stdout and stderr are captured in real-time
4. **Results Parsed**: Jest JSON output is parsed for structured results
5. **Response Sent**: Formatted results are returned to frontend

### Environment Setup

Tests run with these environment variables:
- `NODE_ENV=test`
- `DATABASE_URL`: Uses `TEST_DATABASE_URL` if available, falls back to regular `DATABASE_URL`
- `JWT_SECRET`: Uses existing or defaults to test secret

### Jest Configuration

Tests are executed with these Jest flags:
- `--testPathPattern=integration`: Only run integration tests
- `--verbose`: Detailed output
- `--forceExit`: Prevent hanging processes
- `--json`: Structured JSON output

## 🎨 Frontend Integration

The frontend Settings page (`/settings`) provides:

### Test Suites Overview Tab
- List all available test suites
- Run entire test suites
- View suite-level results
- Expandable detailed results

### Individual Tests Tab
- List all individual tests by suite
- Run specific tests
- Real-time status indicators
- Individual test results

### Features
- **Real-time Status**: Tests show running/passed/failed status
- **Progress Indicators**: Spinning icons for running tests
- **Detailed Results**: Expandable sections with full output
- **Error Handling**: Clear error messages and troubleshooting
- **Summary Statistics**: Overall test counts and results

## 🛠️ Development Tips

### Adding New Tests

1. **Create Test File**: Add new `.test.ts` file in integration folder
2. **Update TEST_SUITES**: Add suite configuration
3. **Frontend Updates**: Test names are currently hardcoded in frontend
4. **Test and Verify**: Ensure tests can be run individually

### Debugging

- **Raw Output**: Always available in test results
- **Error Messages**: Captured from stderr
- **Exit Codes**: Available for debugging process issues
- **Logging**: All test execution is logged on backend

### Performance Considerations

- **Timeout**: Tests have 60-second timeout
- **Database**: Uses separate test database
- **Parallelization**: Disabled in CI for stability
- **Memory**: Monitor for memory leaks in long-running tests

## 🔒 Security Considerations

### Access Control
Currently, test endpoints are **not protected**. Consider adding:
- Authentication requirements
- Role-based access (admin only)
- Rate limiting
- Development-only access

### Environment Safety
- Tests use separate test database
- Environment variables properly isolated
- No production data access

## 🚨 Troubleshooting

### Common Issues

#### Jest Process Hangs
- **Cause**: Database connections not closed
- **Solution**: Ensure proper cleanup in test teardown

#### Test Database Issues
- **Cause**: Missing test database or wrong connection string
- **Solution**: Verify `TEST_DATABASE_URL` environment variable

#### Timeout Errors
- **Cause**: Slow database or network issues
- **Solution**: Increase timeout or optimize tests

#### Memory Issues
- **Cause**: Too many parallel tests or memory leaks
- **Solution**: Reduce parallelization, fix memory leaks

### Debugging Commands

```bash
# Run tests manually to debug
cd backend
NODE_ENV=test npm run test:integration

# Check test database connection
psql $TEST_DATABASE_URL

# View Jest configuration
cat jest.config.js
```

## 📈 Future Enhancements

### Planned Features
- **Real-time Streaming**: WebSocket-based live test output
- **Test History**: Store and track test results over time
- **Performance Metrics**: Track test execution times
- **Test Coverage**: Integration with coverage reports
- **Parallel Execution**: Safe parallel test execution
- **Custom Test Filters**: Filter tests by tags or patterns

### API Improvements
- **Authentication**: Secure test execution endpoints
- **Rate Limiting**: Prevent abuse of test endpoints
- **Batch Operations**: Run multiple test suites simultaneously
- **Test Scheduling**: Schedule automated test runs

### Frontend Enhancements
- **Dark Mode**: Support for dark theme
- **Export Results**: Download test results as JSON/PDF
- **Test Comparison**: Compare results across runs
- **Visual Graphs**: Charts showing test trends
- **Mobile Support**: Responsive design for mobile devices

## 🔗 Related Files

- **Backend Route**: `src/routes/testRunner.ts`
- **Frontend Page**: `frontend/src/app/settings/page.tsx`
- **API Utils**: `frontend/src/utils/api.ts`
- **Jest Config**: `jest.config.js`
- **Test Files**: `src/__tests__/integration/*.test.ts`

## 📚 Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Node.js Child Process](https://nodejs.org/api/child_process.html)
- [Next.js API Routes](https://nextjs.org/docs/api-routes/introduction)
- [Integration Testing Best Practices](https://martinfowler.com/articles/practical-test-pyramid.html) 