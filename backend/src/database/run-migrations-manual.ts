import dotenv from 'dotenv';
import { db } from '../config/database';
import { logger } from '../utils/logger';

// Load environment variables
dotenv.config();

async function runMigrationsManual() {
  try {
    logger.info('Starting manual database migrations...');
    
    // Enable UUID extension
    await db.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    logger.info('✓ UUID extension enabled');

    // Create customers table
    await db.query(`
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
    logger.info('✓ Customers table created');

    // Create wash_types table
    await db.query(`
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
    logger.info('✓ Wash types table created');

    // Create wash_sessions table
    await db.query(`
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
    logger.info('✓ Wash sessions table created');

    // Create indexes
    await db.query('CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_customers_rfid_tag ON customers(rfid_tag)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_customers_membership_status ON customers(membership_status)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_wash_types_relay_id ON wash_types(relay_id)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_wash_types_active ON wash_types(is_active)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_wash_sessions_customer_id ON wash_sessions(customer_id)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_wash_sessions_started_at ON wash_sessions(started_at)');
    logger.info('✓ Indexes created');

    // Insert default wash types
    await db.query(`
      INSERT INTO wash_types (name, description, duration, price, relay_id) VALUES
          ('Basic Wash', 'Exterior wash with soap and rinse', 120, 5.99, 1),
          ('Premium Wash', 'Basic wash plus tire cleaning and wax', 180, 9.99, 2),
          ('Deluxe Wash', 'Premium wash plus interior vacuum and window cleaning', 300, 14.99, 3),
          ('Ultimate Wash', 'Complete wash with all services and detailing', 600, 24.99, 4)
      ON CONFLICT DO NOTHING
    `);
    logger.info('✓ Default wash types inserted');

    logger.info('🎉 Manual database migrations completed successfully!');
    
    // Test the tables
    const customersResult = await db.query('SELECT COUNT(*) FROM customers');
    const washTypesResult = await db.query('SELECT COUNT(*) FROM wash_types');
    
    logger.info(`✓ Tables verified - Customers: ${customersResult.rows[0].count}, Wash Types: ${washTypesResult.rows[0].count}`);
    
  } catch (error) {
    logger.error('Manual migration failed:', error);
    throw error;
  }
}

// Run migrations
runMigrationsManual()
  .then(() => {
    logger.info('✅ Migration script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('❌ Migration script failed:', error);
    process.exit(1);
  }); 