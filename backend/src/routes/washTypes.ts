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
    const result = await db.query(
      'DELETE FROM wash_types WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Wash type not found' });
    }

    logger.info('Wash type deleted:', { id });
    return res.json({ message: 'Wash type deleted successfully' });
  } catch (error) {
    logger.error('Error deleting wash type:', error);
    return res.status(500).json({ error: 'Failed to delete wash type' });
  }
});

export default router; 