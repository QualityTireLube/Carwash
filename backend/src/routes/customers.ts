import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { db } from '../config/database';
import { logger } from '../utils/logger';

const router = Router();

// Validation middleware
const validateCustomer = [
  body('name').trim().isLength({ min: 1 }).withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('rfidTag').optional().isString(),
  body('membershipStatus').isIn(['active', 'inactive', 'pending']).withMessage('Invalid membership status'),
  body('phone').optional().isMobilePhone().withMessage('Valid phone number required'),
];

// Get all customers
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await db.query(
      'SELECT * FROM customers ORDER BY created_at DESC'
    );
    return res.json({ customers: result.rows });
  } catch (error) {
    logger.error('Error fetching customers:', error);
    return res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// Get customer by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      'SELECT * FROM customers WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    return res.json({ customer: result.rows[0] });
  } catch (error) {
    logger.error('Error fetching customer:', error);
    return res.status(500).json({ error: 'Failed to fetch customer' });
  }
});

// Create new customer
router.post('/', validateCustomer, async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, rfidTag, membershipStatus, phone } = req.body;
    
    const result = await db.query(
      `INSERT INTO customers (name, email, rfid_tag, membership_status, phone)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, email, rfidTag, membershipStatus, phone]
    );

    logger.info('Customer created:', { id: result.rows[0].id, email });
    return res.status(201).json({ customer: result.rows[0] });
  } catch (error) {
    logger.error('Error creating customer:', error);
    return res.status(500).json({ error: 'Failed to create customer' });
  }
});

// Update customer
router.put('/:id', validateCustomer, async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { name, email, rfidTag, membershipStatus, phone } = req.body;
    
    const result = await db.query(
      `UPDATE customers 
       SET name = $1, email = $2, rfid_tag = $3, membership_status = $4, phone = $5, updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [name, email, rfidTag, membershipStatus, phone, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    logger.info('Customer updated:', { id, email });
    return res.json({ customer: result.rows[0] });
  } catch (error) {
    logger.error('Error updating customer:', error);
    return res.status(500).json({ error: 'Failed to update customer' });
  }
});

// Delete customer
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      'DELETE FROM customers WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    logger.info('Customer deleted:', { id });
    return res.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    logger.error('Error deleting customer:', error);
    return res.status(500).json({ error: 'Failed to delete customer' });
  }
});

export default router; 