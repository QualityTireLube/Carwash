import { Router, Request, Response } from 'express';
import fetch from 'node-fetch';
import { logger } from '../utils/logger';

const router = Router();

const ESP32_HOST = process.env.ESP32_HOST || 'http://192.168.1.50';

router.post('/trigger/:relayId', async (req: Request, res: Response) => {
  const { relayId } = req.params;
  
  try {
    logger.info(`Triggering relay ${relayId}`);
    
    const response = await fetch(`${ESP32_HOST}/momentary/${relayId}`, { 
      method: 'GET' 
    });
    
    if (!response.ok) {
      throw new Error(`ESP32 responded with status ${response.status}`);
    }
    
    const text = await response.text();
    logger.info(`Relay ${relayId} triggered successfully`);
    
    res.status(200).send(text);
  } catch (error) {
    logger.error('Failed to reach ESP32:', error);
    res.status(500).send('Failed to reach ESP32');
  }
});

// Get relay status
router.get('/status', async (req: Request, res: Response) => {
  try {
    const response = await fetch(`${ESP32_HOST}/status`, { 
      method: 'GET' 
    });
    
    if (!response.ok) {
      throw new Error(`ESP32 responded with status ${response.status}`);
    }
    
    const data = await response.json();
    res.json({ success: true, status: data });
  } catch (error) {
    logger.error('Failed to get ESP32 status:', error);
    res.status(503).json({ 
      success: false, 
      error: 'ESP32 not reachable' 
    });
  }
});

// Test ESP32 connection
router.get('/test', async (req: Request, res: Response) => {
  try {
    const response = await fetch(`${ESP32_HOST}/ping`, { 
      method: 'GET',
      timeout: 3000
    });
    
    if (!response.ok) {
      throw new Error(`ESP32 responded with status ${response.status}`);
    }
    
    const data = await response.text();
    res.json({
      success: true,
      message: 'ESP32 connection successful',
      response: data
    });
  } catch (error) {
    logger.error('ESP32 connection test failed:', error);
    res.status(503).json({
      success: false,
      error: 'ESP32 not reachable'
    });
  }
});

export default router; 