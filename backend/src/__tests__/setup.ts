import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Set up test environment variables if not already set
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://postgres:password@localhost:5432/carwash_test';
}

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test-jwt-secret-key';
}

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'test';
}

// Increase timeout for database operations
jest.setTimeout(30000); 