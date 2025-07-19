import { Pool, PoolClient } from 'pg';
import { logger } from '../utils/logger';

class Database {
  private pool: Pool;

  constructor() {
    // Check if DATABASE_URL is provided
    if (!process.env.DATABASE_URL) {
      const error = new Error('DATABASE_URL environment variable is required but not set');
      logger.error('Database configuration error:', error);
      throw error;
    }

    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on('error', (err) => {
      logger.error('Unexpected error on idle client', err);
      process.exit(-1);
    });

    // Log database configuration (without credentials)
    const dbUrl = process.env.DATABASE_URL;
    const maskedUrl = dbUrl.replace(/(:\/\/)([^:]+):([^@]+)@/, '$1****:****@');
    logger.info('Database configuration:', { 
      url: maskedUrl,
      ssl: process.env.NODE_ENV === 'production',
      maxConnections: 20
    });
  }

  async connect(): Promise<void> {
    try {
      const client = await this.pool.connect();
      logger.info('Database connected successfully');
      client.release();
    } catch (error) {
      logger.error('Database connection failed:', error);
      throw error;
    }
  }

  async query(text: string, params?: any[]): Promise<any> {
    const start = Date.now();
    try {
      const res = await this.pool.query(text, params);
      const duration = Date.now() - start;
      logger.debug('Executed query', { text, duration, rows: res.rowCount });
      return res;
    } catch (error) {
      logger.error('Query error:', error);
      throw error;
    }
  }

  async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

export const db = new Database();

export const connectDatabase = async (): Promise<void> => {
  await db.connect();
}; 