import { Router, Request, Response } from 'express';
import axios from 'axios';
import { logger } from '../utils/logger';

const router = Router();

// ESP32 configuration
const ESP32_BASE_URL = process.env.ESP32_BASE_URL || 'http://192.168.1.100';
const ESP32_TIMEOUT = parseInt(process.env.ESP32_TIMEOUT || '5000');

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
    logger.error('Error fetching relay status:', error);
    
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNREFUSED') {
        return res.status(503).json({ 
          error: 'ESP32 not reachable. Please check connection.' 
        });
      }
    }

    return res.status(500).json({ 
      error: 'Failed to fetch relay status',
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
    logger.error('ESP32 connection test failed:', error);
    
    return res.status(503).json({
      success: false,
      error: 'ESP32 not reachable',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
});

export default router; 