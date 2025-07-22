import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { db } from '../config/database';
import { logger } from '../utils/logger';
import { queueCommand } from './relay';

const router = Router();

// Validation middleware for starting wash
const validateStartWash = [
  body('customerId').isUUID().withMessage('Valid customer ID is required'),
  body('washTypeId').isUUID().withMessage('Valid wash type ID is required'),
];

// Start a wash session for a customer
router.post('/start', validateStartWash, async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { customerId, washTypeId, notes } = req.body;

    // Get customer details
    const customerResult = await db.query(
      'SELECT id, name, email, membership_status as "membershipStatus" FROM customers WHERE id = $1',
      [customerId]
    );

    if (customerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Get wash type details
    const washTypeResult = await db.query(
      'SELECT id, name, description, duration, price, relay_id as "relayId", is_active as "isActive" FROM wash_types WHERE id = $1 AND is_active = true',
      [washTypeId]
    );

    if (washTypeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Wash type not found or inactive' });
    }

    const customer = customerResult.rows[0];
    const washType = washTypeResult.rows[0];

    // Check if customer has active membership (optional business logic)
    if (customer.membershipStatus !== 'active') {
      logger.warn('Wash started for customer without active membership:', { customerId, membershipStatus: customer.membershipStatus });
    }

    // Create wash session
    const sessionResult = await db.query(
      `INSERT INTO wash_sessions (customer_id, wash_type_id, relay_id, status, notes)
       VALUES ($1, $2, $3, 'active', $4)
       RETURNING id, customer_id as "customerId", wash_type_id as "washTypeId", relay_id as "relayId", started_at as "startedAt", status, notes`,
      [customerId, washTypeId, washType.relayId, notes || `${washType.name} wash started`]
    );

    const washSession = sessionResult.rows[0];

    // Trigger the relay using the internal relay API
    let relayTriggered = false;
    let relayError = null;

    try {
      logger.info(`Queueing relay ${washType.relayId} command for wash session ${washSession.id}`);
      
      // Use the queue system directly
      const result = queueCommand(washType.relayId, 'session', 1); // Low priority for session commands
      
      if (result.success) {
        relayTriggered = true;
        logger.info(`Relay ${washType.relayId} command queued successfully for session ${washSession.id}, commandId: ${result.command!.id}`);
      } else {
        throw new Error(result.error || 'Failed to queue relay command');
      }
    } catch (error) {
      relayError = error;
      logger.error('Failed to queue relay command:', error);
      
      // Update session status to error
      await db.query(
        'UPDATE wash_sessions SET status = $1, notes = $2 WHERE id = $3',
        ['error', `${washSession.notes}. Relay trigger failed: ${(error as Error).message}`, washSession.id]
      );
    }

    // Schedule automatic completion based on wash duration
    if (relayTriggered) {
      setTimeout(async () => {
        try {
          await db.query(
            'UPDATE wash_sessions SET status = $1, completed_at = NOW() WHERE id = $2 AND status = $3',
            ['completed', washSession.id, 'active']
          );
          logger.info(`Wash session ${washSession.id} automatically completed after ${washType.duration} seconds`);
        } catch (error) {
          logger.error('Error auto-completing wash session:', error);
        }
      }, washType.duration * 1000); // Convert seconds to milliseconds
    }

    return res.status(201).json({
      success: true,
      message: `Wash started for ${customer.name}`,
      session: {
        ...washSession,
        customer: {
          id: customer.id,
          name: customer.name,
          email: customer.email
        },
        washType: {
          id: washType.id,
          name: washType.name,
          description: washType.description,
          duration: washType.duration,
          price: parseFloat(washType.price),
          relayId: washType.relayId
        }
      },
      relayTriggered,
      relayError: relayError ? (relayError as Error).message : null
    });

  } catch (error) {
    logger.error('Error starting wash session:', error);
    return res.status(500).json({ error: 'Failed to start wash session' });
  }
});

// Get all wash sessions with customer and wash type details
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, customerId, limit = 50, offset = 0 } = req.query;
    
    let query = `
      SELECT 
        ws.id,
        ws.customer_id as "customerId",
        ws.wash_type_id as "washTypeId", 
        ws.relay_id as "relayId",
        ws.started_at as "startedAt",
        ws.completed_at as "completedAt",
        ws.status,
        ws.notes,
        c.name as "customerName",
        c.email as "customerEmail",
        wt.name as "washTypeName",
        wt.description as "washTypeDescription",
        wt.duration as "washTypeDuration",
        wt.price as "washTypePrice"
      FROM wash_sessions ws
      LEFT JOIN customers c ON ws.customer_id = c.id
      LEFT JOIN wash_types wt ON ws.wash_type_id = wt.id
    `;
    
    const queryParams = [];
    const conditions = [];
    
    if (status) {
      conditions.push(`ws.status = $${queryParams.length + 1}`);
      queryParams.push(status);
    }
    
    if (customerId) {
      conditions.push(`ws.customer_id = $${queryParams.length + 1}`);
      queryParams.push(customerId);
    }
    
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    query += ` ORDER BY ws.started_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    queryParams.push(limit, offset);

    const result = await db.query(query, queryParams);
    
    // Format the response
    const sessions = result.rows.map((row: any) => ({
      id: row.id,
      customerId: row.customerId,
      washTypeId: row.washTypeId,
      relayId: row.relayId,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      status: row.status,
      notes: row.notes,
      customer: {
        name: row.customerName,
        email: row.customerEmail
      },
      washType: {
        name: row.washTypeName,
        description: row.washTypeDescription,
        duration: row.washTypeDuration,
        price: row.washTypePrice ? parseFloat(row.washTypePrice) : null
      }
    }));

    return res.json({ sessions });
  } catch (error) {
    logger.error('Error fetching wash sessions:', error);
    return res.status(500).json({ error: 'Failed to fetch wash sessions' });
  }
});

// Get active wash sessions
router.get('/active', async (req: Request, res: Response) => {
  try {
    const result = await db.query(`
      SELECT 
        ws.id,
        ws.customer_id as "customerId",
        ws.wash_type_id as "washTypeId", 
        ws.relay_id as "relayId",
        ws.started_at as "startedAt",
        ws.status,
        ws.notes,
        c.name as "customerName",
        c.email as "customerEmail",
        wt.name as "washTypeName",
        wt.duration as "washTypeDuration",
        EXTRACT(EPOCH FROM (NOW() - ws.started_at)) as "elapsedSeconds"
      FROM wash_sessions ws
      LEFT JOIN customers c ON ws.customer_id = c.id
      LEFT JOIN wash_types wt ON ws.wash_type_id = wt.id
      WHERE ws.status = 'active'
      ORDER BY ws.started_at DESC
    `);

    const activeSessions = result.rows.map((row: any) => ({
      id: row.id,
      customerId: row.customerId,
      washTypeId: row.washTypeId,
      relayId: row.relayId,
      startedAt: row.startedAt,
      status: row.status,
      notes: row.notes,
      elapsedSeconds: Math.floor(row.elapsedSeconds),
      customer: {
        name: row.customerName,
        email: row.customerEmail
      },
      washType: {
        name: row.washTypeName,
        duration: row.washTypeDuration
      }
    }));

    return res.json({ activeSessions });
  } catch (error) {
    logger.error('Error fetching active wash sessions:', error);
    return res.status(500).json({ error: 'Failed to fetch active wash sessions' });
  }
});

// Complete a wash session
router.put('/:id/complete', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const result = await db.query(
      `UPDATE wash_sessions 
       SET status = 'completed', completed_at = NOW(), notes = COALESCE($2, notes)
       WHERE id = $1 AND status = 'active'
       RETURNING id, customer_id as "customerId", wash_type_id as "washTypeId", status, completed_at as "completedAt"`,
      [id, notes]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Active wash session not found' });
    }

    const session = result.rows[0];
    logger.info(`Wash session ${id} completed manually`);

    return res.json({
      success: true,
      message: 'Wash session completed',
      session
    });
  } catch (error) {
    logger.error('Error completing wash session:', error);
    return res.status(500).json({ error: 'Failed to complete wash session' });
  }
});

// Cancel a wash session
router.put('/:id/cancel', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const result = await db.query(
      `UPDATE wash_sessions 
       SET status = 'cancelled', completed_at = NOW(), notes = COALESCE($2, notes || ' - CANCELLED')
       WHERE id = $1 AND status = 'active'
       RETURNING id, customer_id as "customerId", wash_type_id as "washTypeId", status, completed_at as "completedAt"`,
      [id, reason]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Active wash session not found' });
    }

    const session = result.rows[0];
    logger.info(`Wash session ${id} cancelled: ${reason || 'No reason provided'}`);

    return res.json({
      success: true,
      message: 'Wash session cancelled',
      session
    });
  } catch (error) {
    logger.error('Error cancelling wash session:', error);
    return res.status(500).json({ error: 'Failed to cancel wash session' });
  }
});

// Get wash sessions for a specific customer
router.get('/customer/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { limit = 20 } = req.query;

    const result = await db.query(`
      SELECT 
        ws.id,
        ws.wash_type_id as "washTypeId", 
        ws.relay_id as "relayId",
        ws.started_at as "startedAt",
        ws.completed_at as "completedAt",
        ws.status,
        ws.notes,
        wt.name as "washTypeName",
        wt.description as "washTypeDescription",
        wt.price as "washTypePrice"
      FROM wash_sessions ws
      LEFT JOIN wash_types wt ON ws.wash_type_id = wt.id
      WHERE ws.customer_id = $1
      ORDER BY ws.started_at DESC
      LIMIT $2
    `, [customerId, limit]);

    const sessions = result.rows.map((row: any) => ({
      id: row.id,
      washTypeId: row.washTypeId,
      relayId: row.relayId,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      status: row.status,
      notes: row.notes,
      washType: {
        name: row.washTypeName,
        description: row.washTypeDescription,
        price: row.washTypePrice ? parseFloat(row.washTypePrice) : null
      }
    }));

    return res.json({ sessions });
  } catch (error) {
    logger.error('Error fetching customer wash sessions:', error);
    return res.status(500).json({ error: 'Failed to fetch customer wash sessions' });
  }
});

export default router; 