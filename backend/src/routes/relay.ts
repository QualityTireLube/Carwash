import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { db } from '../config/database';

const router = Router();

// Pending commands queue for ESP32 polling
export interface PendingCommand {
  id: string;
  relayId: number;
  timestamp: number;
  source: 'manual' | 'session' | 'rfid' | 'reset';
  priority: number;
}

let pendingCommands: PendingCommand[] = [];
let commandIdCounter = 1;

// Spam protection - track last command times per relay
const lastCommandTimes: { [relayId: number]: number } = {};
const COMMAND_COOLDOWN = 2000; // 2 seconds between commands for same relay

// ESP32 polling tracking
let lastEsp32PollTime = 0;
const ESP32_POLL_TIMEOUT = 12000; // Consider ESP32 offline if no poll for 12 seconds (4 missed 3s polls)

// Simple cache for status endpoint to reduce database calls
interface StatusCache {
  timestamp: number;
  data: any;
}
let statusCache: StatusCache | null = null;
const STATUS_CACHE_TTL = 5000; // Cache status for 5 seconds

// Helper function to check if ESP32 is online based on polling activity
function isEsp32Online(): boolean {
  const timeSinceLastPoll = Date.now() - lastEsp32PollTime;
  return timeSinceLastPoll < ESP32_POLL_TIMEOUT;
}

// Helper function to add command to queue with spam protection
export function queueCommand(relayId: number, source: 'manual' | 'session' | 'rfid' | 'reset' = 'manual', priority: number = 1): { success: boolean; command?: PendingCommand; error?: string } {
  // Spam protection - check cooldown period for this relay
  const now = Date.now();
  const lastCommandTime = lastCommandTimes[relayId] || 0;
  const timeSinceLastCommand = now - lastCommandTime;
  
  if (timeSinceLastCommand < COMMAND_COOLDOWN && source !== 'reset') {
    logger.warn(`Command for relay ${relayId} blocked - cooldown active (${COMMAND_COOLDOWN - timeSinceLastCommand}ms remaining)`);
    return {
      success: false,
      error: `Please wait ${Math.ceil((COMMAND_COOLDOWN - timeSinceLastCommand) / 1000)} seconds before triggering relay ${relayId} again`
    };
  }
  
  const command: PendingCommand = {
    id: `cmd_${commandIdCounter++}`,
    relayId,
    timestamp: now,
    source,
    priority
  };
  
  // Remove any existing commands for the same relay (prevent duplicates)
  pendingCommands = pendingCommands.filter(cmd => cmd.relayId !== relayId);
  
  // Add new command and sort by priority (higher priority first)
  pendingCommands.push(command);
  pendingCommands.sort((a, b) => b.priority - a.priority);
  
  // Update last command time for spam protection
  lastCommandTimes[relayId] = now;
  
  logger.info(`Queued command for relay ${relayId}:`, command);
  return { success: true, command };
}

// Helper function to get and remove next command
function getNextCommand(): PendingCommand | null {
  return pendingCommands.shift() || null;
}

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

    // Queue the relay command for ESP32 to pick up
    const result = queueCommand(membership.relayId, 'rfid', 3);
    if (!result.success) {
      return res.status(429).json({ 
        error: result.error,
        rfidReceived: rfidTag,
        relayId: membership.relayId
      });
    }

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

// Trigger relay endpoint (modified to queue commands with spam protection)
router.post('/:relayId', async (req: Request, res: Response) => {
  try {
    const { relayId } = req.params;
    const relayNumber = parseInt(relayId);

    // Validate relay ID
    if (isNaN(relayNumber) || relayNumber < 1 || relayNumber > 6) {
      return res.status(400).json({ 
        error: 'Invalid relay ID. Must be between 1 and 6.' 
      });
    }

    logger.info(`Attempting to queue command for relay ${relayNumber}`);

    // Queue the command for ESP32 polling with spam protection
    const result = queueCommand(relayNumber, 'manual', 2);
    
    if (!result.success) {
      return res.status(429).json({ 
        error: result.error,
        relayId: relayNumber
      });
    }

    return res.json({ 
      success: true, 
      message: `Relay ${relayNumber} command queued`,
      relayId: relayNumber,
      commandId: result.command!.id,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error queueing relay command:', error);
    return res.status(500).json({ 
      error: 'Failed to queue relay command',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
});

// NEW: ESP32 polling endpoint to check for pending commands
router.get('/poll', async (req: Request, res: Response) => {
  try {
    // Track ESP32 polling activity
    lastEsp32PollTime = Date.now();
    
    const command = getNextCommand();
    
    if (command) {
      logger.info(`ESP32 polling: Returning command for relay ${command.relayId}`);
      return res.json({
        hasCommand: true,
        command: {
          id: command.id,
          relayId: command.relayId,
          source: command.source,
          timestamp: command.timestamp
        }
      });
    } else {
      // No commands pending
      return res.json({
        hasCommand: false,
        message: 'No pending commands'
      });
    }

  } catch (error) {
    logger.error('Error in ESP32 polling endpoint:', error);
    return res.status(500).json({ 
      error: 'Failed to process polling request',
      hasCommand: false
    });
  }
});

// NEW: ESP32 completion notification endpoint
router.post('/completed', async (req: Request, res: Response) => {
  try {
    const { commandId, relayId, source, success, message } = req.body;
    
    if (!commandId || !relayId) {
      return res.status(400).json({ error: 'Command ID and relay ID are required' });
    }
    
    const completionMessage = success 
      ? `Wash triggered from the ESP32 - Relay ${relayId} cycled successfully`
      : `Relay ${relayId} cycle failed: ${message || 'Unknown error'}`;
    
    logger.info(`ESP32 completion report:`, {
      commandId,
      relayId,
      source,
      success,
      message: completionMessage
    });
    
    // Store completion notification (you could save this to database if needed)
    // For now, just log and acknowledge
    
    return res.json({
      success: true,
      message: 'Completion notification received',
      notification: completionMessage,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error processing completion notification:', error);
    return res.status(500).json({ 
      error: 'Failed to process completion notification'
    });
  }
});

// MODIFIED: Reset endpoint now queues relay 5 command
router.post('/reset', async (req: Request, res: Response) => {
  try {
    logger.info('Reset command received - queueing relay 5 trigger');
    
    // Clear all pending commands first
    const clearedCommands = pendingCommands.length;
    pendingCommands = [];
    
    // Clear spam protection timers
    Object.keys(lastCommandTimes).forEach(key => {
      delete lastCommandTimes[parseInt(key)];
    });
    
    // Queue relay 5 (reset relay) with highest priority
    const result = queueCommand(5, 'reset', 10); // Highest priority
    
    if (!result.success) {
      return res.status(500).json({ 
        error: 'Failed to queue reset command',
        details: result.error
      });
    }
    
    logger.info(`Reset initiated: Cleared ${clearedCommands} pending commands, queued relay 5 trigger`);
    
    return res.json({ 
      success: true, 
      message: 'Reset initiated - relay 5 will trigger for 500ms',
      clearedCommands,
      resetCommandId: result.command!.id,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error processing reset command:', error);
    return res.status(500).json({ 
      error: 'Failed to process reset command',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
});

// NEW: Reset Options endpoint - just triggers relay 5 like other washes
router.post('/reset-options', async (req: Request, res: Response) => {
  try {
    logger.info('Reset Options command received - triggering relay 5');
    
    // Queue relay 5 command just like any other wash
    const result = queueCommand(5, 'manual', 2);
    
    if (!result.success) {
      return res.status(429).json({ 
        error: result.error,
        relayId: 5
      });
    }

    return res.json({ 
      success: true, 
      message: `Reset Options - Relay 5 command queued`,
      relayId: 5,
      commandId: result.command!.id,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error queueing reset options command:', error);
    return res.status(500).json({ 
      error: 'Failed to queue reset options command',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
});

// Get relay status - now based on ESP32 polling activity with caching
router.get('/status', async (req: Request, res: Response) => {
  try {
    const now = Date.now();
    
    // Check if we have cached data that's still valid
    if (statusCache && (now - statusCache.timestamp) < STATUS_CACHE_TTL) {
      return res.json(statusCache.data);
    }
    
    const timeSinceLastPoll = now - lastEsp32PollTime;
    const online = isEsp32Online();

    const responseData = {
      success: true,
      status: {
        system: online ? 'online' : 'offline',
        lastPollTime: lastEsp32PollTime,
        timeSinceLastPoll: timeSinceLastPoll,
        pollingActive: online
      },
      timestamp: new Date().toISOString()
    };

    if (online) {
      // Cache successful responses
      statusCache = {
        timestamp: now,
        data: responseData
      };
      return res.json(responseData);
    } else {
      const offlineData = {
        error: 'ESP32 not reachable',
        message: 'ESP32 is offline or not connected to the network',
        status: {
          system: 'offline',
          lastPollTime: lastEsp32PollTime,
          timeSinceLastPoll: timeSinceLastPoll,
          pollingActive: false
        },
        timestamp: new Date().toISOString()
      };
      
      // Don't cache offline responses as aggressively
      return res.status(503).json(offlineData);
    }

  } catch (error) {
    logger.error('Error checking ESP32 status:', error);
    return res.status(500).json({ 
      error: 'Failed to check ESP32 status',
      message: 'Internal server error'
    });
  }
});

// Test ESP32 connection - now based on polling activity with caching
router.get('/test', async (req: Request, res: Response) => {
  try {
    const now = Date.now();
    
    // Check if we have cached data that's still valid (use same cache as status)
    if (statusCache && (now - statusCache.timestamp) < STATUS_CACHE_TTL) {
      const cachedOnline = statusCache.data.status?.system === 'online';
      const testResponse = {
        success: cachedOnline,
        message: cachedOnline ? 'ESP32 connection successful' : 'ESP32 not reachable',
        pollingModel: true,
        lastPollTime: lastEsp32PollTime,
        timeSinceLastPoll: now - lastEsp32PollTime,
        cached: true
      };
      
      return cachedOnline ? res.json(testResponse) : res.status(503).json(testResponse);
    }
    
    const timeSinceLastPoll = now - lastEsp32PollTime;
    const online = isEsp32Online();

    const testResponse = {
      success: online,
      message: online ? 'ESP32 connection successful' : 'ESP32 not reachable',
      pollingModel: true,
      lastPollTime: lastEsp32PollTime,
      timeSinceLastPoll: timeSinceLastPoll,
      cached: false
    };

    if (online) {
      return res.json(testResponse);
    } else {
      return res.status(503).json(testResponse);
    }

  } catch (error) {
    logger.error('Error testing ESP32 connection:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to test ESP32 connection',
      message: 'Internal server error'
    });
  }
});

// NEW: Get pending commands queue status (for debugging)
router.get('/queue', async (req: Request, res: Response) => {
  try {
    const now = Date.now();
    const timeSinceLastPoll = now - lastEsp32PollTime;
    
    return res.json({
      success: true,
      esp32Online: isEsp32Online(),
      lastPollTime: lastEsp32PollTime,
      timeSinceLastPoll: timeSinceLastPoll,
      pendingCommands: pendingCommands.length,
      commands: pendingCommands.map(cmd => ({
        id: cmd.id,
        relayId: cmd.relayId,
        source: cmd.source,
        priority: cmd.priority,
        age: now - cmd.timestamp
      })),
      spamProtection: Object.entries(lastCommandTimes).map(([relayId, time]) => ({
        relayId: parseInt(relayId),
        lastCommandTime: time,
        cooldownRemaining: Math.max(0, COMMAND_COOLDOWN - (now - time))
      })),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting queue status:', error);
    return res.status(500).json({ error: 'Failed to get queue status' });
  }
});

export default router; 