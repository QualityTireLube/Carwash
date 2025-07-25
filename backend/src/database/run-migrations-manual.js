const { Pool } = require('pg');
require('dotenv').config();

// Simple logger
const logger = {
  info: (msg, data) => console.log(`[${new Date().toISOString()}] INFO: ${msg}`, data || ''),
  error: (msg, data) => console.error(`[${new Date().toISOString()}] ERROR: ${msg}`, data || '')
};

async function runMigrationsManual() {
  // Log database connection info (without credentials)
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    logger.error('DATABASE_URL environment variable is missing!');
    throw new Error('DATABASE_URL environment variable is required');
  }
  
  const maskedUrl = dbUrl.replace(/(:\/\/)([^:]+):([^@]+)@/, '$1****:****@');
  logger.info('🚀 Starting migration process...');
  logger.info('Migration connecting to database:', { url: maskedUrl });

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  try {
    logger.info('Starting manual database migrations...');
    
    // Test connection first
    logger.info('Testing database connection...');
    await pool.query('SELECT NOW()');
    logger.info('✓ Database connection successful');
    
    // Enable UUID extension
    await pool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    logger.info('✓ UUID extension enabled');

    // Create customers table
    await pool.query(`
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
    await pool.query(`
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
      await pool.query('ALTER TABLE wash_types ADD CONSTRAINT wash_types_name_unique UNIQUE (name)');
      logger.info('✓ UNIQUE constraint added to wash_types.name');
    } catch (error) {
      if (error.message.includes('already exists')) {
        logger.info('✓ UNIQUE constraint already exists on wash_types.name');
      } else {
        logger.info('Note: Could not add UNIQUE constraint, continuing without it');
      }
    }

    // Create wash_sessions table
    await pool.query(`
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

    // Create customer_memberships table
    logger.info('Creating customer_memberships table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS customer_memberships (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
          wash_type_id UUID NOT NULL REFERENCES wash_types(id) ON DELETE CASCADE,
          status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'expired', 'suspended')),
          start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          end_date TIMESTAMP WITH TIME ZONE,
          billing_cycle VARCHAR(20) DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'quarterly', 'annual', 'lifetime')),
          price DECIMAL(10,2),
          stripe_subscription_id VARCHAR(255),
          notes TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    logger.info('✅ Customer memberships table created successfully!');

    // Create indexes
    await pool.query('CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_customers_rfid_tag ON customers(rfid_tag)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_customers_membership_status ON customers(membership_status)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_wash_types_relay_id ON wash_types(relay_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_wash_types_active ON wash_types(is_active)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_wash_sessions_customer_id ON wash_sessions(customer_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_wash_sessions_started_at ON wash_sessions(started_at)');
    
    // Customer memberships indexes
    await pool.query('CREATE INDEX IF NOT EXISTS idx_customer_memberships_customer_id ON customer_memberships(customer_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_customer_memberships_wash_type_id ON customer_memberships(wash_type_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_customer_memberships_status ON customer_memberships(status)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_customer_memberships_dates ON customer_memberships(start_date, end_date)');
    
    // Unique constraint to prevent duplicate active memberships
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_memberships_unique_active 
      ON customer_memberships(customer_id, wash_type_id) 
      WHERE status = 'active'
    `);
    
    logger.info('✓ Indexes created');

    // Create trigger function for customer_memberships updated_at
    await pool.query(`
      CREATE OR REPLACE FUNCTION update_customer_memberships_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    
    await pool.query(`
      DROP TRIGGER IF EXISTS trigger_update_customer_memberships_updated_at ON customer_memberships;
      CREATE TRIGGER trigger_update_customer_memberships_updated_at
          BEFORE UPDATE ON customer_memberships
          FOR EACH ROW
          EXECUTE FUNCTION update_customer_memberships_updated_at()
    `);
    logger.info('✓ Customer memberships triggers created');

    // Insert default wash types with correct pricing and relay assignments
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
        await pool.query(`
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
        const existing = await pool.query('SELECT id FROM wash_types WHERE name = $1', [washType.name]);
        if (existing.rows.length === 0) {
          // Insert new
          await pool.query(`
            INSERT INTO wash_types (name, description, duration, price, relay_id) 
            VALUES ($1, $2, $3, $4, $5)
          `, [washType.name, washType.description, washType.duration, washType.price, washType.relay_id]);
          logger.info(`✓ Inserted new wash type: ${washType.name}`);
        } else {
          // Update existing
          await pool.query(`
            UPDATE wash_types 
            SET description = $2, duration = $3, price = $4, relay_id = $5, updated_at = NOW()
            WHERE name = $1
          `, [washType.name, washType.description, washType.duration, washType.price, washType.relay_id]);
          logger.info(`✓ Updated existing wash type: ${washType.name}`);
        }
      }
    }

    // Add RFID tag to customer_memberships table (new migration)
    logger.info('Adding RFID tag field to customer_memberships...');
    try {
      await pool.query(`
        ALTER TABLE customer_memberships 
        ADD COLUMN IF NOT EXISTS rfid_tag VARCHAR(100) UNIQUE
      `);
      await pool.query('CREATE INDEX IF NOT EXISTS idx_customer_memberships_rfid_tag ON customer_memberships(rfid_tag)');
      logger.info('✅ RFID tag field added to customer_memberships table');
    } catch (rfidError) {
      logger.info('RFID field may already exist, continuing...');
    }

    logger.info('🎉 Manual database migrations completed successfully!');
    
    // Test the tables
    logger.info('Verifying tables exist...');
    const customersResult = await pool.query('SELECT COUNT(*) FROM customers');
    const washTypesResult = await pool.query('SELECT COUNT(*) FROM wash_types');
    
    // Specifically test customer_memberships table
    logger.info('Testing customer_memberships table...');
    const membershipResult = await pool.query('SELECT COUNT(*) FROM customer_memberships');
    
    // Verify table structure
    const membershipSchema = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'customer_memberships' 
      ORDER BY ordinal_position
    `);
    
    logger.info(`✅ Tables verified - Customers: ${customersResult.rows[0].count}, Wash Types: ${washTypesResult.rows[0].count}, Memberships: ${membershipResult.rows[0].count}`);
    logger.info(`✅ Customer memberships table has ${membershipSchema.rows.length} columns`);
    
  } catch (error) {
    logger.error('❌ MIGRATION FAILED! This will cause API errors.');
    logger.error('Migration error details:', error);
    logger.error('Error stack:', error.stack);
    throw error;
  } finally {
    await pool.end();
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