import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { db } from '../config/database';
import { logger } from '../utils/logger';

const router = Router();

// Validation middleware for membership creation/update
const validateMembership = [
  body('customerId').isUUID().withMessage('Valid customer ID is required'),
  body('washTypeId').isUUID().withMessage('Valid wash type ID is required'),
  body('status').optional().isIn(['active', 'inactive', 'expired', 'suspended']).withMessage('Invalid status'),
  body('billingCycle').optional().isIn(['monthly', 'quarterly', 'annual', 'lifetime']).withMessage('Invalid billing cycle'),
  body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('endDate').optional().isISO8601().withMessage('End date must be a valid date'),
];

// Get all memberships for a customer
router.get('/customer/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    
    const result = await db.query(`
      SELECT 
        cm.id,
        cm.customer_id as "customerId",
        cm.wash_type_id as "washTypeId",
        cm.status,
        cm.start_date as "startDate",
        cm.end_date as "endDate",
        cm.billing_cycle as "billingCycle",
        cm.price,
        cm.stripe_subscription_id as "stripeSubscriptionId",
        cm.notes,
        cm.created_at as "createdAt",
        cm.updated_at as "updatedAt",
        wt.name as "washTypeName",
        wt.description as "washTypeDescription",
        wt.duration as "washTypeDuration",
        wt.relay_id as "washTypeRelayId"
      FROM customer_memberships cm
      LEFT JOIN wash_types wt ON cm.wash_type_id = wt.id
      WHERE cm.customer_id = $1
      ORDER BY cm.status ASC, cm.created_at DESC
    `, [customerId]);

    const memberships = result.rows.map((row: any) => ({
      id: row.id,
      customerId: row.customerId,
      washTypeId: row.washTypeId,
      status: row.status,
      startDate: row.startDate,
      endDate: row.endDate,
      billingCycle: row.billingCycle,
      price: row.price ? parseFloat(row.price) : null,
      stripeSubscriptionId: row.stripeSubscriptionId,
      notes: row.notes,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      washType: {
        name: row.washTypeName,
        description: row.washTypeDescription,
        duration: row.washTypeDuration,
        relayId: row.washTypeRelayId
      }
    }));

    return res.json({ memberships });
  } catch (error) {
    logger.error('Error fetching customer memberships:', error);
    return res.status(500).json({ error: 'Failed to fetch customer memberships' });
  }
});

// Get all customers with memberships for a wash type
router.get('/wash-type/:washTypeId', async (req: Request, res: Response) => {
  try {
    const { washTypeId } = req.params;
    
    const result = await db.query(`
      SELECT 
        cm.id,
        cm.customer_id as "customerId",
        cm.wash_type_id as "washTypeId",
        cm.status,
        cm.start_date as "startDate",
        cm.end_date as "endDate",
        cm.billing_cycle as "billingCycle",
        cm.price,
        cm.created_at as "createdAt",
        c.name as "customerName",
        c.email as "customerEmail",
        c.membership_status as "customerMembershipStatus"
      FROM customer_memberships cm
      LEFT JOIN customers c ON cm.customer_id = c.id
      WHERE cm.wash_type_id = $1
      ORDER BY cm.status ASC, c.name ASC
    `, [washTypeId]);

    const memberships = result.rows.map((row: any) => ({
      id: row.id,
      customerId: row.customerId,
      washTypeId: row.washTypeId,
      status: row.status,
      startDate: row.startDate,
      endDate: row.endDate,
      billingCycle: row.billingCycle,
      price: row.price ? parseFloat(row.price) : null,
      createdAt: row.createdAt,
      customer: {
        name: row.customerName,
        email: row.customerEmail,
        membershipStatus: row.customerMembershipStatus
      }
    }));

    return res.json({ memberships });
  } catch (error) {
    logger.error('Error fetching wash type memberships:', error);
    return res.status(500).json({ error: 'Failed to fetch wash type memberships' });
  }
});

// Create a new membership
router.post('/', validateMembership, async (req: Request, res: Response) => {
  try {
    // EMERGENCY FIX: Ensure table exists before any operation
    try {
      await db.query('SELECT 1 FROM customer_memberships LIMIT 1');
    } catch (tableError) {
      if ((tableError as any).code === '42P01') {
        logger.info('🚨 Table missing! Creating customer_memberships table...');
        await db.query(`
          CREATE TABLE customer_memberships (
              id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
              customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
              wash_type_id UUID NOT NULL REFERENCES wash_types(id) ON DELETE CASCADE,
              status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'expired', 'suspended')),
              start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
              end_date TIMESTAMP WITH TIME ZONE,
              billing_cycle VARCHAR(20) DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'quarterly', 'annual', 'lifetime')),
              price DECIMAL(10,2),
              stripe_subscription_id VARCHAR(255),
              notes TEXT,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
              updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          )
        `);
        logger.info('✅ Emergency table creation successful!');
      }
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { 
      customerId, 
      washTypeId, 
      status = 'active',
      billingCycle = 'monthly',
      price,
      endDate,
      notes
    } = req.body;

    // Check if customer exists
    const customerResult = await db.query('SELECT id, name FROM customers WHERE id = $1', [customerId]);
    if (customerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Check if wash type exists
    const washTypeResult = await db.query('SELECT id, name, price FROM wash_types WHERE id = $1', [washTypeId]);
    if (washTypeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Wash type not found' });
    }

    // Check if customer already has an active membership for this wash type
    const existingMembership = await db.query(
      'SELECT id FROM customer_memberships WHERE customer_id = $1 AND wash_type_id = $2 AND status = $3',
      [customerId, washTypeId, 'active']
    );

    if (existingMembership.rows.length > 0) {
      return res.status(409).json({ 
        error: 'Customer already has an active membership for this wash type' 
      });
    }

    // Use wash type price if no custom price provided
    const membershipPrice = price !== undefined ? price : parseFloat(washTypeResult.rows[0].price);

    const result = await db.query(`
      INSERT INTO customer_memberships (
        customer_id, wash_type_id, status, billing_cycle, price, end_date, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING 
        id,
        customer_id as "customerId",
        wash_type_id as "washTypeId",
        status,
        start_date as "startDate",
        end_date as "endDate",
        billing_cycle as "billingCycle",
        price,
        notes,
        created_at as "createdAt",
        updated_at as "updatedAt"
    `, [customerId, washTypeId, status, billingCycle, membershipPrice, endDate, notes]);

    const membership = {
      ...result.rows[0],
      price: result.rows[0].price ? parseFloat(result.rows[0].price) : null
    };

    logger.info('Customer membership created:', { 
      membershipId: membership.id,
      customerId,
      washTypeId,
      customerName: customerResult.rows[0].name,
      washTypeName: washTypeResult.rows[0].name
    });

    return res.status(201).json({ 
      success: true,
      message: `Membership created for ${customerResult.rows[0].name}`,
      membership 
    });
  } catch (error) {
    logger.error('Error creating customer membership:', error);
    return res.status(500).json({ error: 'Failed to create membership' });
  }
});

// Update a membership
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, endDate, notes, price } = req.body;

    const updateFields = [];
    const values = [];
    let paramCount = 1;

    if (status !== undefined) {
      updateFields.push(`status = $${paramCount++}`);
      values.push(status);
    }
    if (endDate !== undefined) {
      updateFields.push(`end_date = $${paramCount++}`);
      values.push(endDate);
    }
    if (notes !== undefined) {
      updateFields.push(`notes = $${paramCount++}`);
      values.push(notes);
    }
    if (price !== undefined) {
      updateFields.push(`price = $${paramCount++}`);
      values.push(price);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updateFields.push('updated_at = NOW()');
    values.push(id);

    const result = await db.query(`
      UPDATE customer_memberships 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING 
        id,
        customer_id as "customerId",
        wash_type_id as "washTypeId",
        status,
        start_date as "startDate",
        end_date as "endDate",
        billing_cycle as "billingCycle",
        price,
        notes,
        updated_at as "updatedAt"
    `, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Membership not found' });
    }

    const membership = {
      ...result.rows[0],
      price: result.rows[0].price ? parseFloat(result.rows[0].price) : null
    };

    logger.info('Customer membership updated:', { id, status });

    return res.json({ 
      success: true,
      message: 'Membership updated successfully',
      membership 
    });
  } catch (error) {
    logger.error('Error updating customer membership:', error);
    return res.status(500).json({ error: 'Failed to update membership' });
  }
});

// Cancel/Delete a membership
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // First get membership details for logging
    const membershipResult = await db.query(`
      SELECT cm.id, c.name as customer_name, wt.name as wash_type_name
      FROM customer_memberships cm
      LEFT JOIN customers c ON cm.customer_id = c.id
      LEFT JOIN wash_types wt ON cm.wash_type_id = wt.id
      WHERE cm.id = $1
    `, [id]);

    if (membershipResult.rows.length === 0) {
      return res.status(404).json({ error: 'Membership not found' });
    }

    // Delete the membership
    const result = await db.query(
      'DELETE FROM customer_memberships WHERE id = $1 RETURNING id',
      [id]
    );

    const membershipInfo = membershipResult.rows[0];
    logger.info('Customer membership deleted:', { 
      id,
      customerName: membershipInfo.customer_name,
      washTypeName: membershipInfo.wash_type_name
    });

    return res.json({ 
      success: true,
      message: 'Membership cancelled successfully' 
    });
  } catch (error) {
    logger.error('Error deleting customer membership:', error);
    return res.status(500).json({ error: 'Failed to cancel membership' });
  }
});

// Get membership by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(`
      SELECT 
        cm.id,
        cm.customer_id as "customerId",
        cm.wash_type_id as "washTypeId",
        cm.status,
        cm.start_date as "startDate",
        cm.end_date as "endDate",
        cm.billing_cycle as "billingCycle",
        cm.price,
        cm.stripe_subscription_id as "stripeSubscriptionId",
        cm.notes,
        cm.created_at as "createdAt",
        cm.updated_at as "updatedAt",
        c.name as "customerName",
        c.email as "customerEmail",
        wt.name as "washTypeName",
        wt.description as "washTypeDescription"
      FROM customer_memberships cm
      LEFT JOIN customers c ON cm.customer_id = c.id
      LEFT JOIN wash_types wt ON cm.wash_type_id = wt.id
      WHERE cm.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Membership not found' });
    }

    const row = result.rows[0];
    const membership = {
      id: row.id,
      customerId: row.customerId,
      washTypeId: row.washTypeId,
      status: row.status,
      startDate: row.startDate,
      endDate: row.endDate,
      billingCycle: row.billingCycle,
      price: row.price ? parseFloat(row.price) : null,
      stripeSubscriptionId: row.stripeSubscriptionId,
      notes: row.notes,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      customer: {
        name: row.customerName,
        email: row.customerEmail
      },
      washType: {
        name: row.washTypeName,
        description: row.washTypeDescription
      }
    };

    return res.json({ membership });
  } catch (error) {
    logger.error('Error fetching membership:', error);
    return res.status(500).json({ error: 'Failed to fetch membership' });
  }
});

// Emergency table creation endpoint
router.post('/emergency-create-table', async (req: Request, res: Response) => {
  try {
    logger.info('🚨 EMERGENCY: Creating customer_memberships table...');
    
    // Drop table if exists
    try {
      await db.query('DROP TABLE IF EXISTS customer_memberships CASCADE');
      logger.info('Dropped existing table');
    } catch (e) {
      logger.info('No table to drop');
    }
    
    // Create table
    await db.query(`
      CREATE TABLE customer_memberships (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
          wash_type_id UUID NOT NULL REFERENCES wash_types(id) ON DELETE CASCADE,
          status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'expired', 'suspended')),
          start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          end_date TIMESTAMP WITH TIME ZONE,
          billing_cycle VARCHAR(20) DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'quarterly', 'annual', 'lifetime')),
          price DECIMAL(10,2),
          stripe_subscription_id VARCHAR(255),
          notes TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    
    // Test insert
    const testCount = await db.query('SELECT COUNT(*) FROM customer_memberships');
    
    logger.info('✅ EMERGENCY TABLE CREATION SUCCESSFUL!');
    
    return res.json({
      success: true,
      message: 'Table created successfully',
      count: testCount.rows[0].count
    });
    
  } catch (error) {
    logger.error('❌ EMERGENCY TABLE CREATION FAILED:', error);
    return res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

export default router; 