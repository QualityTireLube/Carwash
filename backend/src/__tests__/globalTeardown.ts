import { Pool } from 'pg';
import { logger } from '../utils/logger';

export default async function globalTeardown() {
  try {
    // Connect to test database first to close any connections
    const testPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: false,
    });

    // Close test database connections
    await testPool.end();

    // Connect to postgres to drop test database
    const adminPool = new Pool({
      connectionString: process.env.DATABASE_URL?.replace('/carwash_test', '/postgres'),
      ssl: false,
    });

    // Drop test database (optional - you might want to keep it for debugging)
    if (process.env.NODE_ENV === 'test' && process.env.CLEANUP_TEST_DB !== 'false') {
      try {
        await adminPool.query('DROP DATABASE IF EXISTS carwash_test');
        logger.info('✓ Test database dropped');
      } catch (error: any) {
        logger.warn('Database cleanup warning:', error.message);
      }
    }

    await adminPool.end();
    logger.info('✓ Test database cleanup complete');

  } catch (error) {
    logger.error('❌ Test database cleanup failed:', error);
    // Don't throw here to avoid masking test failures
  }
} 