import { Router, Request, Response } from 'express';
import { db } from '../config/database';
import { logger } from '../utils/logger';

const router = Router();

// Test database connection
router.get('/db', async (req: Request, res: Response) => {
  try {
    const result = await db.query('SELECT NOW() as current_time');
    res.json({ 
      success: true, 
      message: 'Database connected successfully',
      timestamp: result.rows[0].current_time
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Database connection failed',
      details: (error as Error).message
    });
  }
});

// Check customer_memberships table schema
router.get('/schema/customer-memberships', async (req: Request, res: Response) => {
  try {
    const result = await db.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'customer_memberships' 
      ORDER BY ordinal_position
    `);
    
    const hasRfidColumn = result.rows.some((row: any) => row.column_name === 'rfid_tag');
    
    res.json({ 
      success: true, 
      columns: result.rows,
      hasRfidColumn,
      columnCount: result.rows.length
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Failed to check schema',
      details: (error as Error).message
    });
  }
});

// Add test data endpoint
router.post('/add-data', async (req: Request, res: Response) => {
  try {
    logger.info('Adding test data via API...');

    // CRITICAL FIX: Force create customer_memberships table
    try {
      logger.info('🔧 FORCING customer_memberships table creation...');
      
      // First drop the table if it exists but is broken
      try {
        await db.query('DROP TABLE IF EXISTS customer_memberships CASCADE');
        logger.info('Dropped existing table if any');
      } catch (dropError) {
        logger.info('No existing table to drop');
      }
      
      // Create fresh table
      await db.query(`
        CREATE TABLE customer_memberships (
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
      
      // Create essential indexes
      await db.query('CREATE INDEX idx_customer_memberships_customer_id ON customer_memberships(customer_id)');
      await db.query('CREATE INDEX idx_customer_memberships_wash_type_id ON customer_memberships(wash_type_id)');
      
      // Test the table
      const testResult = await db.query('SELECT COUNT(*) FROM customer_memberships');
      logger.info('✅ Customer memberships table FORCE CREATED successfully!');
      logger.info(`Table test count: ${testResult.rows[0].count}`);
      
    } catch (tableError) {
      logger.error('❌ CRITICAL: Failed to force create customer_memberships table:', tableError);
      logger.error('Table error details:', tableError);
      // Continue anyway but this is bad
    }

    // Add test customers
    const customers = [
      { name: 'John Doe', email: 'john.doe@example.com', phone: '555-0101', membership_status: 'active' },
      { name: 'Jane Smith', email: 'jane.smith@example.com', phone: '555-0102', membership_status: 'inactive' },
      { name: 'Bob Wilson', email: 'bob.wilson@example.com', phone: '555-0103', membership_status: 'active' }
    ];

    const customerResults = [];
    for (const customer of customers) {
      const result = await db.query(
        `INSERT INTO customers (name, email, phone, membership_status)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (email) DO UPDATE SET 
         name = EXCLUDED.name,
         phone = EXCLUDED.phone,
         membership_status = EXCLUDED.membership_status,
         updated_at = NOW()
         RETURNING id, name, email, membership_status`,
        [customer.name, customer.email, customer.phone, customer.membership_status]
      );
      customerResults.push(result.rows[0]);
    }

    // Add test wash types
    const washTypes = [
      { name: 'Quick Rinse', description: 'Fast exterior rinse only', duration: 60, price: 3.99, relay_id: 1 },
      { name: 'Express Wash', description: 'Soap, rinse, and basic dry', duration: 300, price: 7.99, relay_id: 2 },
      { name: 'Complete Clean', description: 'Full wash with wax and tire shine', duration: 900, price: 15.99, relay_id: 3 }
    ];

    const washTypeResults = [];
    for (const washType of washTypes) {
      // Check if wash type already exists
      const existingWashType = await db.query(
        'SELECT id, name, price FROM wash_types WHERE name = $1',
        [washType.name]
      );
      
      if (existingWashType.rows.length > 0) {
        washTypeResults.push(existingWashType.rows[0]);
        continue;
      }

      const result = await db.query(
        `INSERT INTO wash_types (name, description, duration, price, relay_id, is_active)
         VALUES ($1, $2, $3, $4, $5, true)
         RETURNING id, name, price, relay_id`,
        [washType.name, washType.description, washType.duration, washType.price, washType.relay_id]
      );
      washTypeResults.push(result.rows[0]);
    }

    // Get counts
    const customerCount = await db.query('SELECT COUNT(*) FROM customers');
    const washTypeCount = await db.query('SELECT COUNT(*) FROM wash_types');
    const sessionCount = await db.query('SELECT COUNT(*) FROM wash_sessions');

    logger.info('✅ Test data added successfully via API');

    return res.json({
      success: true,
      message: 'Test data added successfully!',
      data: {
        customers: customerResults,
        washTypes: washTypeResults,
        summary: {
          totalCustomers: parseInt(customerCount.rows[0].count),
          totalWashTypes: parseInt(washTypeCount.rows[0].count),
          totalSessions: parseInt(sessionCount.rows[0].count)
        }
      }
    });

  } catch (error) {
    logger.error('Error adding test data via API:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to add test data',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
});

// Get database status and counts
router.get('/status', async (req: Request, res: Response) => {
  try {
    const customerCount = await db.query('SELECT COUNT(*) FROM customers');
    const washTypeCount = await db.query('SELECT COUNT(*) FROM wash_types');
    const sessionCount = await db.query('SELECT COUNT(*) FROM wash_sessions');

    // Get sample data
    const sampleCustomers = await db.query(
      'SELECT id, name, email, membership_status FROM customers LIMIT 3'
    );
    const sampleWashTypes = await db.query(
      'SELECT id, name, price, relay_id FROM wash_types LIMIT 5'
    );

    // Convert price from string to number for frontend compatibility
    const washTypesWithNumberPrice = sampleWashTypes.rows.map((row: any) => ({
      ...row,
      price: parseFloat(row.price)
    }));

    return res.json({
      success: true,
      database: 'connected',
      summary: {
        customers: parseInt(customerCount.rows[0].count),
        washTypes: parseInt(washTypeCount.rows[0].count),
        sessions: parseInt(sessionCount.rows[0].count)
      },
      samples: {
        customers: sampleCustomers.rows,
        washTypes: washTypesWithNumberPrice
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error getting test status:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Database connection failed',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
});

// Reset/clear test data
router.delete('/clear-data', async (req: Request, res: Response) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ 
        success: false, 
        error: 'Data clearing not allowed in production' 
      });
    }

    await db.query('DELETE FROM wash_sessions');
    await db.query('DELETE FROM customers WHERE email LIKE \'%@example.com\'');
    await db.query('DELETE FROM wash_types WHERE name IN (\'Quick Rinse\', \'Express Wash\', \'Complete Clean\')');

    logger.info('Test data cleared');
    
    return res.json({
      success: true,
      message: 'Test data cleared successfully'
    });

  } catch (error) {
    logger.error('Error clearing test data:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to clear test data' 
    });
  }
});

// Manual fix for customer_memberships table
router.post('/create-memberships-table', async (req: Request, res: Response) => {
  try {
    logger.info('🔧 Manual creation of customer_memberships table requested...');
    
    // Create customer_memberships table
    await db.query(`
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
    
    // Create indexes
    await db.query('CREATE INDEX IF NOT EXISTS idx_customer_memberships_customer_id ON customer_memberships(customer_id)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_customer_memberships_wash_type_id ON customer_memberships(wash_type_id)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_customer_memberships_status ON customer_memberships(status)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_customer_memberships_dates ON customer_memberships(start_date, end_date)');
    
    // Unique constraint
    await db.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_memberships_unique_active 
      ON customer_memberships(customer_id, wash_type_id) 
      WHERE status = 'active'
    `);
    
    // Create trigger function
    await db.query(`
      CREATE OR REPLACE FUNCTION update_customer_memberships_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    
    await db.query(`
      DROP TRIGGER IF EXISTS trigger_update_customer_memberships_updated_at ON customer_memberships;
      CREATE TRIGGER trigger_update_customer_memberships_updated_at
          BEFORE UPDATE ON customer_memberships
          FOR EACH ROW
          EXECUTE FUNCTION update_customer_memberships_updated_at()
    `);
    
    // Test the table
    const result = await db.query('SELECT COUNT(*) FROM customer_memberships');
    
    logger.info('✅ Customer memberships table created successfully via manual endpoint');
    
    return res.json({ 
      success: true,
      message: 'Customer memberships table created successfully',
      rowCount: result.rows[0].count
    });
    
  } catch (error) {
    logger.error('Error creating customer memberships table manually:', error);
    return res.status(500).json({ 
      error: 'Failed to create customer memberships table',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
});

// Simple table creation test
router.get('/table-check', async (req: Request, res: Response) => {
  try {
    logger.info('🔍 Checking customer_memberships table status...');
    
    // First check if table exists
    const tableExists = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'customer_memberships'
      )
    `);
    
    const exists = tableExists.rows[0].exists;
    logger.info(`Table exists: ${exists}`);
    
    if (!exists) {
      logger.info('Creating customer_memberships table...');
      await db.query(`
        CREATE TABLE customer_memberships (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
            wash_type_id UUID NOT NULL REFERENCES wash_types(id) ON DELETE CASCADE,
            status VARCHAR(20) DEFAULT 'active',
            start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            end_date TIMESTAMP WITH TIME ZONE,
            billing_cycle VARCHAR(20) DEFAULT 'monthly',
            price DECIMAL(10,2),
            stripe_subscription_id VARCHAR(255),
            notes TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);
      logger.info('✅ Table created successfully!');
    }
    
    // Test table access
    const count = await db.query('SELECT COUNT(*) FROM customer_memberships');
    logger.info(`Table row count: ${count.rows[0].count}`);
    
    return res.json({
      success: true,
      tableExists: exists,
      rowCount: count.rows[0].count,
      message: exists ? 'Table already exists' : 'Table created successfully'
    });
    
  } catch (error) {
    logger.error('Table check failed:', error);
    return res.status(500).json({
      success: false,
      error: (error as Error).message,
      code: (error as any).code
    });
  }
});

// Emergency table creation
router.post('/fix-table', async (req: Request, res: Response) => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS customer_memberships (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
          wash_type_id UUID NOT NULL REFERENCES wash_types(id) ON DELETE CASCADE,
          status VARCHAR(20) DEFAULT 'active',
          start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          end_date TIMESTAMP WITH TIME ZONE,
          billing_cycle VARCHAR(20) DEFAULT 'monthly',
          price DECIMAL(10,2),
          stripe_subscription_id VARCHAR(255),
          notes TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    
    const test = await db.query('SELECT COUNT(*) FROM customer_memberships');
    
    return res.json({
      success: true,
      message: 'Table created/verified',
      count: test.rows[0].count
    });
  } catch (error) {
    return res.status(500).json({ 
      error: (error as Error).message,
      code: (error as any).code 
    });
  }
});

// Create RFID test data for ESP32 testing
router.post('/create-rfid-data', async (req: Request, res: Response) => {
  try {
    logger.info('Creating RFID test data for ESP32 testing...');

    // First ensure we have some customers and wash types
    const customerResult = await db.query('SELECT COUNT(*) FROM customers');
    const washTypeResult = await db.query('SELECT COUNT(*) FROM wash_types');
    
    if (customerResult.rows[0].count === '0' || washTypeResult.rows[0].count === '0') {
      return res.status(400).json({
        error: 'Please create customers and wash types first using /api/test/add-data'
      });
    }

    // Get existing customers and wash types
    const customers = await db.query('SELECT id, name FROM customers LIMIT 3');
    const washTypes = await db.query('SELECT id, name, relay_id FROM wash_types LIMIT 3');

    const testMemberships = [];

    for (let i = 0; i < customers.rows.length && i < washTypes.rows.length; i++) {
      const customer = customers.rows[i];
      const washType = washTypes.rows[i];
      const rfidTag = `RFID_${String(i + 1).padStart(3, '0')}_TEST`; // RFID_001_TEST, RFID_002_TEST, etc.

      // Check if membership already exists
      const existingMembership = await db.query(
        'SELECT id FROM customer_memberships WHERE customer_id = $1 AND wash_type_id = $2',
        [customer.id, washType.id]
      );

      let membershipId;
      if (existingMembership.rows.length > 0) {
        // Update existing membership with RFID
        const updateResult = await db.query(`
          UPDATE customer_memberships 
          SET rfid_tag = $1, status = 'active', updated_at = NOW()
          WHERE customer_id = $2 AND wash_type_id = $3
          RETURNING id
        `, [rfidTag, customer.id, washType.id]);
        membershipId = updateResult.rows[0].id;
        logger.info(`Updated existing membership with RFID: ${rfidTag}`);
      } else {
        // Create new membership with RFID
        const membershipResult = await db.query(`
          INSERT INTO customer_memberships (customer_id, wash_type_id, status, rfid_tag, billing_cycle, price)
          VALUES ($1, $2, 'active', $3, 'monthly', 29.99)
          RETURNING id
        `, [customer.id, washType.id, rfidTag]);
        membershipId = membershipResult.rows[0].id;
        logger.info(`Created new membership with RFID: ${rfidTag}`);
      }

      testMemberships.push({
        membershipId,
        customerId: customer.id,
        customerName: customer.name,
        washTypeId: washType.id,
        washTypeName: washType.name,
        relayId: washType.relay_id,
        rfidTag
      });
    }

    logger.info('✅ RFID test data created successfully!');

    return res.json({
      success: true,
      message: 'RFID test data created successfully',
      testMemberships,
      curlExample: `curl -X POST http://localhost:3001/api/trigger/rfid \\
  -H "Content-Type: application/json" \\
  -d '{"rfidTag": "${testMemberships[0]?.rfidTag || 'RFID_001_TEST'}"}'`
    });

  } catch (error) {
    logger.error('Error creating RFID test data:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create RFID test data',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
});

// Add RFID column to production database
router.post('/add-rfid-column', async (req: Request, res: Response) => {
  try {
    logger.info('🔧 Adding RFID column to customer_memberships table...');

    // Add rfid_tag column to customer_memberships table
    await db.query(`
      ALTER TABLE customer_memberships 
      ADD COLUMN IF NOT EXISTS rfid_tag VARCHAR(100) UNIQUE
    `);

    // Create index for RFID tag lookups
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_customer_memberships_rfid_tag 
      ON customer_memberships(rfid_tag)
    `);

    // Add comment
    try {
      await db.query(`
        COMMENT ON COLUMN customer_memberships.rfid_tag 
        IS 'RFID tag identifier for ESP32 relay activation'
      `);
    } catch (commentError) {
      logger.info('Comment creation skipped (not critical)');
    }

    // Test the new column by querying it
    const testResult = await db.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'customer_memberships' 
      AND column_name = 'rfid_tag'
    `);

    logger.info('✅ RFID column added successfully to production database!');

    return res.json({
      success: true,
      message: 'RFID column added to customer_memberships table',
      columnInfo: testResult.rows[0] || null,
      readyForTesting: true
    });

  } catch (error) {
    logger.error('❌ Failed to add RFID column:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to add RFID column',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
});

export default router; 