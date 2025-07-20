import { Pool } from 'pg';
import { logger } from '../utils/logger';

export default async function globalSetup() {
  try {
    // Create a connection to postgres to create test database
    const adminPool = new Pool({
      connectionString: process.env.DATABASE_URL?.replace('/carwash_test', '/postgres'),
      ssl: false,
    });

    // Try to create test database (ignore if it already exists)
    try {
      await adminPool.query('CREATE DATABASE carwash_test');
      logger.info('✓ Test database created');
    } catch (error: any) {
      if (error.code !== '42P04') { // Database already exists
        logger.warn('Database creation warning:', error.message);
      }
    } finally {
      await adminPool.end();
    }

    // Connect to test database and run migrations
    const testPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: false,
    });

    // Enable UUID extension
    await testPool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    // Create tables
    await testPool.query(`
      CREATE TABLE IF NOT EXISTS customers (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          phone VARCHAR(20),
          rfid_tag VARCHAR(100) UNIQUE,
          membership_status VARCHAR(20) DEFAULT 'inactive' CHECK (membership_status IN ('active', 'inactive', 'pending')),
          stripe_customer_id VARCHAR(255) UNIQUE,
          stripe_subscription_id VARCHAR(255),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await testPool.query(`
      CREATE TABLE IF NOT EXISTS wash_types (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          name VARCHAR(255) NOT NULL,
          description TEXT,
          duration INTEGER NOT NULL CHECK (duration > 0),
          price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
          relay_id INTEGER NOT NULL CHECK (relay_id >= 1 AND relay_id <= 4),
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await testPool.query(`
      CREATE TABLE IF NOT EXISTS wash_sessions (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
          wash_type_id UUID REFERENCES wash_types(id) ON DELETE SET NULL,
          relay_id INTEGER NOT NULL CHECK (relay_id >= 1 AND relay_id <= 5),
          started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          completed_at TIMESTAMP WITH TIME ZONE,
          status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled', 'error')),
          notes TEXT
      )
    `);

    // Create indexes
    await testPool.query('CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email)');
    await testPool.query('CREATE INDEX IF NOT EXISTS idx_customers_rfid_tag ON customers(rfid_tag)');

    logger.info('✓ Test database setup complete');
    await testPool.end();

  } catch (error) {
    logger.error('❌ Test database setup failed:', error);
    throw error;
  }
} 