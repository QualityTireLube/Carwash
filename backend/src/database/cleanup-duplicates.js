const { Pool } = require('pg');
require('dotenv').config();

// Simple logger
const logger = {
  info: (msg, data) => console.log(`[${new Date().toISOString()}] INFO: ${msg}`, data || ''),
  error: (msg, data) => console.error(`[${new Date().toISOString()}] ERROR: ${msg}`, data || '')
};

async function cleanupDuplicateWashTypes() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  try {
    logger.info('🧹 Starting cleanup of duplicate wash types...');
    
    // First, show current wash types
    const currentTypes = await pool.query('SELECT name, price, relay_id, created_at FROM wash_types ORDER BY created_at');
    logger.info(`Current wash types (${currentTypes.rows.length} total):`);
    currentTypes.rows.forEach(row => {
      logger.info(`  - ${row.name}: $${row.price}, Relay ${row.relay_id}, Created: ${row.created_at}`);
    });

    // Add UNIQUE constraint if it doesn't exist
    logger.info('Adding UNIQUE constraint to wash_types.name...');
    try {
      await pool.query('ALTER TABLE wash_types ADD CONSTRAINT wash_types_name_unique UNIQUE (name)');
      logger.info('✓ UNIQUE constraint added');
    } catch (error) {
      if (error.message.includes('already exists')) {
        logger.info('✓ UNIQUE constraint already exists');
      } else {
        logger.error('Failed to add constraint:', error.message);
      }
    }

    // Remove duplicates - keep the newest version of each wash type
    logger.info('Removing duplicate wash types (keeping newest)...');
    const duplicateQuery = `
      DELETE FROM wash_types 
      WHERE id NOT IN (
        SELECT DISTINCT ON (name) id 
        FROM wash_types 
        ORDER BY name, created_at DESC
      )
    `;
    
    const deleteResult = await pool.query(duplicateQuery);
    logger.info(`✓ Removed ${deleteResult.rowCount} duplicate wash types`);

    // Update any remaining wash types to correct values
    logger.info('Updating wash types to correct pricing and relay assignments...');
    
    const updates = [
      { name: 'Ultimate Wash', price: 24.99, relay_id: 1, duration: 300, description: 'Complete wash with all services and detailing' },
      { name: 'Premium Wash', price: 9.99, relay_id: 2, duration: 180, description: 'Basic wash plus tire cleaning and wax' },
      { name: 'Express Wash', price: 7.99, relay_id: 3, duration: 150, description: 'Soap, rinse, and basic dry' },
      { name: 'Basic Wash', price: 5.99, relay_id: 4, duration: 120, description: 'Exterior wash with soap and rinse' }
    ];

    for (const update of updates) {
      const result = await pool.query(
        `UPDATE wash_types 
         SET price = $2, relay_id = $3, duration = $4, description = $5, updated_at = NOW()
         WHERE name = $1`,
        [update.name, update.price, update.relay_id, update.duration, update.description]
      );
      if (result.rowCount > 0) {
        logger.info(`✓ Updated ${update.name}: $${update.price}, Relay ${update.relay_id}`);
      }
    }

    // Remove any test wash types that shouldn't be there
    logger.info('Removing test wash types...');
    const testTypes = ['Quick Rinse', 'Complete Clean', 'Deluxe Wash'];
    for (const testType of testTypes) {
      const result = await pool.query('DELETE FROM wash_types WHERE name = $1', [testType]);
      if (result.rowCount > 0) {
        logger.info(`✓ Removed test wash type: ${testType}`);
      }
    }

    // Show final state
    const finalTypes = await pool.query('SELECT name, price, relay_id, created_at FROM wash_types ORDER BY relay_id');
    logger.info(`\n✅ Cleanup complete! Final wash types (${finalTypes.rows.length} total):`);
    finalTypes.rows.forEach(row => {
      logger.info(`  - ${row.name}: $${row.price}, Relay ${row.relay_id}`);
    });

  } catch (error) {
    logger.error('❌ Cleanup failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run cleanup
cleanupDuplicateWashTypes()
  .then(() => {
    logger.info('✅ Cleanup script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('❌ Cleanup script failed:', error);
    process.exit(1);
  }); 