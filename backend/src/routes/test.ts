import { Router, Request, Response } from 'express';
import { db } from '../config/database';
import { logger } from '../utils/logger';

const router = Router();

// Add test data endpoint
router.post('/add-data', async (req: Request, res: Response) => {
  try {
    logger.info('Adding test data via API...');

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
        washTypes: sampleWashTypes.rows
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

export default router; 