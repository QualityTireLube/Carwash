import { db } from '../config/database';
import { logger } from '../utils/logger';

async function addTestData() {
  try {
    logger.info('Adding test data to database...');

    // Add test customers
    const customers = [
      {
        name: 'John Doe',
        email: 'john.doe@example.com',
        phone: '555-0101',
        membership_status: 'active'
      },
      {
        name: 'Jane Smith',
        email: 'jane.smith@example.com',
        phone: '555-0102',
        membership_status: 'inactive'
      },
      {
        name: 'Bob Wilson',
        email: 'bob.wilson@example.com',
        phone: '555-0103',
        membership_status: 'active'
      }
    ];

    logger.info('Inserting test customers...');
    for (const customer of customers) {
      const result = await db.query(
        `INSERT INTO customers (name, email, phone, membership_status)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (email) DO NOTHING
         RETURNING id, name, email`,
        [customer.name, customer.email, customer.phone, customer.membership_status]
      );
      
      if (result.rows.length > 0) {
        logger.info(`Created customer: ${result.rows[0].name} (${result.rows[0].email})`);
      } else {
        logger.info(`Customer already exists: ${customer.email}`);
      }
    }

    // Add test wash types (only if not already inserted from migration)
    const washTypes = [
      {
        name: 'Quick Rinse',
        description: 'Fast exterior rinse only',
        duration: 60, // 1 minute in seconds
        price: 3.99,
        relay_id: 1
      },
      {
        name: 'Express Wash',
        description: 'Soap, rinse, and basic dry',
        duration: 300, // 5 minutes in seconds
        price: 7.99,
        relay_id: 2
      },
      {
        name: 'Complete Clean',
        description: 'Full wash with wax and tire shine',
        duration: 900, // 15 minutes in seconds
        price: 15.99,
        relay_id: 3
      }
    ];

    logger.info('Inserting test wash types...');
    for (const washType of washTypes) {
      const result = await db.query(
        `INSERT INTO wash_types (name, description, duration, price, relay_id, is_active)
         VALUES ($1, $2, $3, $4, $5, true)
         ON CONFLICT DO NOTHING
         RETURNING id, name, price`,
        [washType.name, washType.description, washType.duration, washType.price, washType.relay_id]
      );
      
      if (result.rows.length > 0) {
        logger.info(`Created wash type: ${result.rows[0].name} - $${result.rows[0].price}`);
      }
    }

    // Add a test wash session
    logger.info('Adding test wash session...');
    const customerResult = await db.query(
      'SELECT id FROM customers WHERE email = $1 LIMIT 1',
      ['john.doe@example.com']
    );
    
    const washTypeResult = await db.query(
      'SELECT id FROM wash_types WHERE name = $1 LIMIT 1',
      ['Express Wash']
    );

    if (customerResult.rows.length > 0 && washTypeResult.rows.length > 0) {
      await db.query(
        `INSERT INTO wash_sessions (customer_id, wash_type_id, relay_id, status, notes)
         VALUES ($1, $2, 2, 'completed', 'Test wash session - completed successfully')
         ON CONFLICT DO NOTHING`,
        [customerResult.rows[0].id, washTypeResult.rows[0].id]
      );
      logger.info('Created test wash session');
    }

    logger.info('✅ Test data added successfully!');
    
    // Show summary
    const customerCount = await db.query('SELECT COUNT(*) FROM customers');
    const washTypeCount = await db.query('SELECT COUNT(*) FROM wash_types');
    const sessionCount = await db.query('SELECT COUNT(*) FROM wash_sessions');
    
    logger.info('Database Summary:');
    logger.info(`- Customers: ${customerCount.rows[0].count}`);
    logger.info(`- Wash Types: ${washTypeCount.rows[0].count}`);
    logger.info(`- Wash Sessions: ${sessionCount.rows[0].count}`);

  } catch (error) {
    logger.error('Error adding test data:', error);
    throw error;
  }
}

// Run if this file is executed directly
if (typeof require !== 'undefined' && require.main === module) {
  addTestData()
    .then(() => {
      logger.info('Test data script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Test data script failed:', error);
      process.exit(1);
    });
}

export { addTestData }; 