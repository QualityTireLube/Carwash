import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

import { connectDatabase } from './config/database';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';
// Import removed - using manual migration instead
import { db } from './config/database'; // Added import for db

// Routes
import customerRoutes from './routes/customers';
import washTypeRoutes from './routes/washTypes';
import washSessionRoutes from './routes/washSessions';
import customerMembershipRoutes from './routes/customerMemberships';
import relayRoutes from './routes/relay';
import stripeRoutes from './routes/stripe';
import testRoutes from './routes/test';
import testRunnerRoutes from './routes/testRunner';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy for production environments (Render, Heroku, etc.)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Security middleware
app.use(helmet());
// CORS configuration
const corsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'https://qualitywash.vercel.app',
      'https://qualitywash.vercel.app/',
      process.env.CORS_ORIGIN
    ].filter(Boolean) as string[];
    
    // Allow any Vercel app URL for this project (more permissive matching)
    const isVercelApp = origin.endsWith('.vercel.app') && (
      origin.includes('qualitywash') || 
      origin.includes('stephen-villavasos-projects')
    );
    
    // Log the origin for debugging
    logger.info('CORS request from origin:', { origin, isVercelApp, allowedOrigins });
    
    if (allowedOrigins.includes(origin) || isVercelApp) {
      callback(null, true);
    } else {
      logger.warn('CORS blocked origin:', { origin });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200 // Some legacy browsers (IE11, various SmartTVs) choke on 204
};

app.use(cors(corsOptions));

// Rate limiting middleware to prevent excessive requests
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limit each IP to 500 requests per windowMs (reduced from default)
  message: {
    error: 'Too many requests from this IP, please try again later',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all routes
app.use(limiter);

// More restrictive rate limiting for ESP32 polling endpoint
const esp32Limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // Allow 20 requests per minute (for 10s polling interval)
  message: {
    error: 'ESP32 polling rate limit exceeded',
    retryAfter: '1 minute'
  },
  skip: (req) => {
    // Only apply to the polling endpoint
    return !req.path.includes('/api/trigger/poll');
  }
});

app.use('/api/trigger', esp32Limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', async (req, res) => {
  const health = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    database: 'unknown',
    version: process.env.npm_package_version || '1.0.0'
  };

  try {
    // Test database connection
    await db.query('SELECT 1');
    health.database = 'connected';
  } catch (error) {
    health.database = 'disconnected';
    health.status = 'ERROR';
    logger.error('Health check database error:', error);
  }

  const statusCode = health.status === 'OK' ? 200 : 503;
  res.status(statusCode).json(health);
});

// API routes
app.use('/api/customers', customerRoutes);
app.use('/api/wash-types', washTypeRoutes);
app.use('/api/wash-sessions', washSessionRoutes);
app.use('/api/memberships', customerMembershipRoutes);
app.use('/api/trigger', relayRoutes);
app.use('/api/stripe', stripeRoutes);
app.use('/api/test', testRoutes);
app.use('/api/test-runner', testRunnerRoutes);

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl 
  });
});

// Start server
const startServer = async () => {
  try {
    // Connect to database
    await connectDatabase();
    logger.info('Database connected successfully');

    // Check if tables exist - migrations should be run separately
    try {
      await db.query('SELECT 1 FROM customers LIMIT 1');
      await db.query('SELECT 1 FROM wash_types LIMIT 1');
      logger.info('Database tables verified successfully');
    } catch (tableError) {
      logger.error('Database tables missing. Please run: npm run migrate:manual');
      logger.error('Table check error details:', tableError);
      if (process.env.NODE_ENV === 'production') {
        logger.error('Exiting due to missing database tables in production');
        logger.info('Note: If this is a fresh deployment, migrations should run automatically');
        process.exit(1);
      } else {
        logger.warn('Continuing in development mode despite missing tables');
      }
    }

    // Start server
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app; 