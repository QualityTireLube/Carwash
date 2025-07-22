import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { db } from '../config/database';
import { logger } from '../utils/logger';

const router = Router();

// Validation middleware
const validateWashType = [
  body('name').trim().isLength({ min: 1 }).withMessage('Name is required'),
  body('description').optional().isString(),
  body('duration').isInt({ min: 1 }).withMessage('Duration must be a positive integer'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('relayId').isInt({ min: 1, max: 4 }).withMessage('Relay ID must be between 1 and 4'),
  body('isActive').optional().isBoolean(),
];

// Get all wash types
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await db.query(
      'SELECT id, name, description, duration, price, relay_id as "relayId", is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt" FROM wash_types ORDER BY name ASC'
    );
    
    // Convert price from string to number for frontend compatibility
    const washTypes = result.rows.map((row: any) => ({
      ...row,
      price: parseFloat(row.price)
    }));
    
    return res.json({ washTypes });
  } catch (error) {
    logger.error('Error fetching wash types:', error);
    return res.status(500).json({ error: 'Failed to fetch wash types' });
  }
});

// Get wash type by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      'SELECT id, name, description, duration, price, relay_id as "relayId", is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt" FROM wash_types WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Wash type not found' });
    }
    
    // Convert price from string to number for frontend compatibility
    const washType = {
      ...result.rows[0],
      price: parseFloat(result.rows[0].price)
    };
    
    return res.json({ washType });
  } catch (error) {
    logger.error('Error fetching wash type:', error);
    return res.status(500).json({ error: 'Failed to fetch wash type' });
  }
});

// Create new wash type
router.post('/', validateWashType, async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, duration, price, relayId, isActive = true } = req.body;
    
    const result = await db.query(
      `INSERT INTO wash_types (name, description, duration, price, relay_id, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, description, duration, price, relay_id as "relayId", is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"`,
      [name, description, duration, price, relayId, isActive]
    );

    // Convert price from string to number for frontend compatibility
    const washType = {
      ...result.rows[0],
      price: parseFloat(result.rows[0].price)
    };

    logger.info('Wash type created:', { id: washType.id, name });
    return res.status(201).json({ washType });
  } catch (error) {
    logger.error('Error creating wash type:', error);
    return res.status(500).json({ error: 'Failed to create wash type' });
  }
});

// Update wash type
router.put('/:id', validateWashType, async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { name, description, duration, price, relayId, isActive } = req.body;
    
    const result = await db.query(
      `UPDATE wash_types 
       SET name = $1, description = $2, duration = $3, price = $4, relay_id = $5, is_active = $6, updated_at = NOW()
       WHERE id = $7
       RETURNING id, name, description, duration, price, relay_id as "relayId", is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"`,
      [name, description, duration, price, relayId, isActive, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Wash type not found' });
    }

    // Convert price from string to number for frontend compatibility
    const washType = {
      ...result.rows[0],
      price: parseFloat(result.rows[0].price)
    };

    logger.info('Wash type updated:', { id, name });
    return res.json({ washType });
  } catch (error) {
    logger.error('Error updating wash type:', error);
    return res.status(500).json({ error: 'Failed to update wash type' });
  }
});

// Delete wash type
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // First, check what references this wash type
    const membershipCheck = await db.query(
      'SELECT COUNT(*) as count FROM customer_memberships WHERE wash_type_id = $1',
      [id]
    );
    
    const sessionCheck = await db.query(
      'SELECT COUNT(*) as count FROM wash_sessions WHERE wash_type_id = $1',
      [id]
    );
    
    const membershipCount = parseInt(membershipCheck.rows[0].count);
    const sessionCount = parseInt(sessionCheck.rows[0].count);
    
    logger.info('Wash type deletion check:', { 
      id, 
      membershipCount, 
      sessionCount 
    });
    
    // Use a transaction to ensure atomicity
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Delete the wash type (this will cascade to customer_memberships due to ON DELETE CASCADE)
      // Sessions will have their wash_type_id set to NULL due to ON DELETE SET NULL
      const result = await client.query(
        'DELETE FROM wash_types WHERE id = $1 RETURNING *',
        [id]
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Wash type not found' });
      }

      await client.query('COMMIT');
      
      logger.info('Wash type deleted successfully:', { 
        id, 
        deletedMemberships: membershipCount,
        affectedSessions: sessionCount 
      });
      
      return res.json({ 
        message: 'Wash type deleted successfully',
        details: {
          deletedMemberships: membershipCount,
          affectedSessions: sessionCount
        }
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    logger.error('Error deleting wash type:', error);
    
    // Check if it's a foreign key constraint error
    if ((error as any).code === '23503') {
      return res.status(409).json({ 
        error: 'Cannot delete wash type due to existing references. Please remove all associated data first.',
        details: 'This wash type is referenced by other records in the database.'
      });
    }
    
    return res.status(500).json({ error: 'Failed to delete wash type' });
  }
});

// Debug endpoint to check wash type references (for troubleshooting)
router.get('/:id/debug', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Get wash type info
    const washType = await db.query(
      'SELECT * FROM wash_types WHERE id = $1',
      [id]
    );
    
    if (washType.rows.length === 0) {
      return res.status(404).json({ error: 'Wash type not found' });
    }
    
    // Get related memberships
    const memberships = await db.query(`
      SELECT cm.*, c.name as customer_name, c.email as customer_email
      FROM customer_memberships cm
      LEFT JOIN customers c ON cm.customer_id = c.id
      WHERE cm.wash_type_id = $1
    `, [id]);
    
    // Get related sessions
    const sessions = await db.query(`
      SELECT ws.*, c.name as customer_name, c.email as customer_email
      FROM wash_sessions ws
      LEFT JOIN customers c ON ws.customer_id = c.id
      WHERE ws.wash_type_id = $1
      LIMIT 10
    `, [id]);
    
    // Get recent sessions count
    const sessionCount = await db.query(
      'SELECT COUNT(*) as count FROM wash_sessions WHERE wash_type_id = $1',
      [id]
    );
    
    return res.json({
      washType: washType.rows[0],
      relatedData: {
        memberships: {
          count: memberships.rows.length,
          records: memberships.rows
        },
        sessions: {
          total: parseInt(sessionCount.rows[0].count),
          recent: sessions.rows
        }
      }
    });
    
  } catch (error) {
    logger.error('Error debugging wash type:', error);
    return res.status(500).json({ error: 'Failed to debug wash type' });
  }
});

export default router; 