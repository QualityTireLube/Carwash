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

    // Add UNIQUE constraint to name column if it doesn't exist
    logger.info('Adding UNIQUE constraint to wash_types.name...');
    try {
      await db.query('ALTER TABLE wash_types ADD CONSTRAINT wash_types_name_unique UNIQUE (name)');
      logger.info('✓ UNIQUE constraint added to wash_types.name');
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        logger.info('✓ UNIQUE constraint already exists on wash_types.name');
      } else {
        logger.info('Note: Could not add UNIQUE constraint, continuing without it');
      }
    }

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
    logger.info('Inserting/updating default wash types...');
    const washTypes = [
      { name: 'Ultimate Wash', description: 'Complete wash with all services and detailing', duration: 300, price: 24.99, relay_id: 1 },
      { name: 'Premium Wash', description: 'Basic wash plus tire cleaning and wax', duration: 180, price: 9.99, relay_id: 2 },
      { name: 'Express Wash', description: 'Soap, rinse, and basic dry', duration: 150, price: 7.99, relay_id: 3 },
      { name: 'Basic Wash', description: 'Exterior wash with soap and rinse', duration: 120, price: 5.99, relay_id: 4 }
    ];

    for (const washType of washTypes) {
      try {
        // Try to insert, if name constraint exists it will be handled
        await db.query(`
          INSERT INTO wash_types (name, description, duration, price, relay_id) 
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (name) DO UPDATE SET
            description = EXCLUDED.description,
            duration = EXCLUDED.duration,
            price = EXCLUDED.price,
            relay_id = EXCLUDED.relay_id,
            updated_at = NOW()
        `, [washType.name, washType.description, washType.duration, washType.price, washType.relay_id]);
        logger.info(`✓ Inserted/updated wash type: ${washType.name}`);
      } catch (conflictError) {
        // If no unique constraint, try a different approach
        const existing = await db.query('SELECT id FROM wash_types WHERE name = $1', [washType.name]);
        if (existing.rows.length === 0) {
          // Insert new
          await db.query(`
            INSERT INTO wash_types (name, description, duration, price, relay_id) 
            VALUES ($1, $2, $3, $4, $5)
          `, [washType.name, washType.description, washType.duration, washType.price, washType.relay_id]);
          logger.info(`✓ Inserted new wash type: ${washType.name}`);
        } else {
          // Update existing
          await db.query(`
            UPDATE wash_types 
            SET description = $2, duration = $3, price = $4, relay_id = $5, updated_at = NOW()
            WHERE name = $1
          `, [washType.name, washType.description, washType.duration, washType.price, washType.relay_id]);
          logger.info(`✓ Updated existing wash type: ${washType.name}`);
        }
      }
    }

    logger.info('🎉 Manual database migrations completed successfully!');
    
    // Test the tables
    const customersResult = await db.query('SELECT COUNT(*) FROM customers');
    const washTypesResult = await db.query('SELECT COUNT(*) FROM wash_types');
    
    logger.info(`✓ Tables verified - Customers: ${customersResult.rows[0].count}, Wash Types: ${washTypesResult.rows[0].count}`);
    
    // Add RFID tag to customer_memberships table (new migration)
    logger.info('Adding RFID tag field to customer_memberships...');
    try {
      await db.query(`
        ALTER TABLE customer_memberships 
        ADD COLUMN IF NOT EXISTS rfid_tag VARCHAR(100) UNIQUE
      `);
      await db.query('CREATE INDEX IF NOT EXISTS idx_customer_memberships_rfid_tag ON customer_memberships(rfid_tag)');
      logger.info('✅ RFID tag field added to customer_memberships table');
    } catch (rfidError) {
      logger.info('RFID field may already exist, continuing...');
    }

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