import { readFileSync } from 'fs';
import { join } from 'path';
import { db } from '../config/database';
import { logger } from '../utils/logger';

async function runMigrations() {
  try {
    logger.info('Starting database migrations...');
    
    // Read the migration file
    const migrationPath = join(__dirname, 'migrations', '001_initial_schema.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');
    
    // Split the SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map((stmt: string) => stmt.trim())
      .filter((stmt: string) => stmt.length > 0 && !stmt.startsWith('--'));
    
    // Execute each statement
    for (const statement of statements) {
      if (statement.trim()) {
        logger.info(`Executing: ${statement.substring(0, 50)}...`);
        await db.query(statement);
      }
    }
    
    logger.info('Database migrations completed successfully!');
  } catch (error) {
    logger.error('Migration failed:', error);
    throw error;
  }
}

// Run migrations if this file is executed directly
if (typeof require !== 'undefined' && require.main === module) {
  runMigrations()
    .then(() => {
      logger.info('Migrations completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Migration failed:', error);
      process.exit(1);
    });
}

export { runMigrations }; 