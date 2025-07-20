import { Router, Request, Response } from 'express';
import axios from 'axios';
import { logger } from '../utils/logger';
import { db } from '../config/database';

const router = Router();

// ESP32 configuration
const ESP32_BASE_URL = process.env.ESP32_BASE_URL || 'http://192.168.1.100';
const ESP32_TIMEOUT = parseInt(process.env.ESP32_TIMEOUT || '5000');

// RFID lookup endpoint for ESP32
router.post('/rfid', async (req: Request, res: Response) => {
  try {
    const { rfidTag } = req.body;

    if (!rfidTag) {
      return res.status(400).json({ 
        error: 'RFID tag is required',
        rfidReceived: null,
        relayId: null
      });
    }

    logger.info(`ESP32 RFID lookup request for tag: ${rfidTag}`);

    // Look up active membership with this RFID tag
    const membershipResult = await db.query(`
      SELECT 
        cm.id as "membershipId",
        cm.rfid_tag as "rfidTag",
        cm.status as "membershipStatus",
        cm.customer_id as "customerId",
        c.name as "customerName",
        wt.id as "washTypeId",
        wt.name as "washTypeName",
        wt.relay_id as "relayId",
        wt.duration as "duration",
        wt.is_active as "washTypeActive"
      FROM customer_memberships cm
      JOIN customers c ON cm.customer_id = c.id
      JOIN wash_types wt ON cm.wash_type_id = wt.id
      WHERE cm.rfid_tag = $1 
        AND cm.status = 'active'
        AND wt.is_active = true
      LIMIT 1
    `, [rfidTag]);

    if (membershipResult.rows.length === 0) {
      logger.warn(`No active membership found for RFID: ${rfidTag}`);
      return res.status(404).json({ 
        error: 'No active membership found for this RFID tag',
        rfidReceived: rfidTag,
        relayId: null
      });
    }

    const membership = membershipResult.rows[0];
    
    logger.info(`Active membership found for RFID ${rfidTag}:`, {
      customer: membership.customerName,
      washType: membership.washTypeName,
      relayId: membership.relayId
    });

    // Return the relay information for ESP32
    return res.json({
      success: true,
      rfidReceived: rfidTag,
      relayId: membership.relayId,
      membership: {
        id: membership.membershipId,
        customer: {
          id: membership.customerId,
          name: membership.customerName
        },
        washType: {
          id: membership.washTypeId,
          name: membership.washTypeName,
          duration: membership.duration
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error processing RFID lookup:', error);
    return res.status(500).json({ 
      error: 'Failed to process RFID lookup',
      rfidReceived: req.body.rfidTag || null,
      relayId: null,
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
});

// Trigger relay endpoint
router.post('/:relayId', async (req: Request, res: Response) => {
  try {
    const { relayId } = req.params;
    const relayNumber = parseInt(relayId);

    // Validate relay ID
    if (isNaN(relayNumber) || relayNumber < 1 || relayNumber > 5) {
      return res.status(400).json({ 
        error: 'Invalid relay ID. Must be between 1 and 5.' 
      });
    }

    logger.info(`Triggering relay ${relayNumber}`);

    // Send command to ESP32
    const response = await axios.post(
      `${ESP32_BASE_URL}/trigger`,
      { relay: relayNumber },
      { 
        timeout: ESP32_TIMEOUT,
        headers: { 'Content-Type': 'application/json' }
      }
    );

    if (response.status === 200) {
      logger.info(`Relay ${relayNumber} triggered successfully`);
      return res.json({ 
        success: true, 
        message: `Relay ${relayNumber} triggered`,
        relayId: relayNumber,
        timestamp: new Date().toISOString()
      });
    } else {
      throw new Error(`ESP32 returned status ${response.status}`);
    }

  } catch (error) {
    logger.error('Error triggering relay:', error);
    
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNREFUSED') {
        return res.status(503).json({ 
          error: 'ESP32 not reachable. Please check connection.' 
        });
      }
      if (error.code === 'ETIMEDOUT') {
        return res.status(504).json({ 
          error: 'ESP32 request timed out.' 
        });
      }
    }

    return res.status(500).json({ 
      error: 'Failed to trigger relay',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
});

// Get relay status
router.get('/status', async (req: Request, res: Response) => {
  try {
    const response = await axios.get(
      `${ESP32_BASE_URL}/status`,
      { timeout: ESP32_TIMEOUT }
    );

    return res.json({
      success: true,
      status: response.data,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.debug('Error fetching relay status (expected if ESP32 is offline):', error);
    
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNREFUSED') {
        return res.status(503).json({ 
          error: 'ESP32 not reachable. Please check connection.',
          message: 'ESP32 is offline or not connected to the network'
        });
      }
    }

    return res.status(503).json({ 
      error: 'ESP32 not reachable',
      message: 'ESP32 is offline or not connected to the network',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
});

// Test ESP32 connection
router.get('/test', async (req: Request, res: Response) => {
  try {
    const response = await axios.get(
      `${ESP32_BASE_URL}/ping`,
      { timeout: 3000 }
    );

    return res.json({
      success: true,
      message: 'ESP32 connection successful',
      response: response.data
    });

  } catch (error) {
    // Don't log this as an error since ESP32 might not be running
    logger.debug('ESP32 connection test failed (expected if ESP32 is offline):', error);
    
    return res.status(503).json({
      success: false,
      error: 'ESP32 not reachable',
      message: 'ESP32 is offline or not connected to the network',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
});

export default router; 