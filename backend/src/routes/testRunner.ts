import { Router, Request, Response } from 'express';
import { spawn } from 'child_process';
import { join } from 'path';
import { logger } from '../utils/logger';

const router = Router();

// Available test suites and individual tests
const TEST_SUITES = {
  'customer-creation': {
    name: 'Customer Creation Tests',
    description: 'Tests for creating, validating, and managing customers',
    file: 'customers.test.ts',
    tests: [
      'should create a customer with all required fields',
      'should create a customer with minimal required fields only',
      'should create a customer with all optional fields',
      'should create multiple customers with different email addresses',
      'should persist customer data to database correctly',
      'should return 400 when name is missing',
      'should return 400 when name is empty string',
      'should return 400 when name is only whitespace',
      'should return 400 when email is missing',
      'should return 400 when email format is invalid',
      'should return 400 when membershipStatus is invalid',
      'should return 400 when phone number format is invalid',
      'should return 400 with multiple validation errors',
      'should return 500 when trying to create customer with duplicate email',
      'should return 500 when trying to create customer with duplicate RFID tag',
      'should handle very long names correctly',
      'should trim whitespace from name field',
      'should handle special characters in name',
      'should create customer without phone number',
      'should create customer without RFID tag',
      'should handle all valid membership statuses'
    ]
  }
};

// Get available test suites
router.get('/suites', async (req: Request, res: Response) => {
  try {
    const suites = Object.entries(TEST_SUITES).map(([key, suite]) => ({
      id: key,
      name: suite.name,
      description: suite.description,
      testCount: suite.tests.length
    }));

    return res.json({ 
      success: true, 
      suites,
      totalTests: Object.values(TEST_SUITES).reduce((acc, suite) => acc + suite.tests.length, 0)
    });
  } catch (error) {
    logger.error('Error fetching test suites:', error);
    return res.status(500).json({ error: 'Failed to fetch test suites' });
  }
});

// Run all integration tests
router.post('/run-all', async (req: Request, res: Response) => {
  try {
    const result = await runTests();
    return res.json(result);
  } catch (error) {
    logger.error('Error running all tests:', error);
    return res.status(500).json({ error: 'Failed to run tests' });
  }
});

// Run specific test suite
router.post('/run-suite/:suiteId', async (req: Request, res: Response) => {
  try {
    const { suiteId } = req.params;
    const suite = TEST_SUITES[suiteId as keyof typeof TEST_SUITES];
    
    if (!suite) {
      return res.status(404).json({ error: 'Test suite not found' });
    }

    const result = await runTests(suite.file);
    return res.json(result);
  } catch (error) {
    logger.error('Error running test suite:', error);
    return res.status(500).json({ error: 'Failed to run test suite' });
  }
});

// Run specific test by pattern
router.post('/run-test', async (req: Request, res: Response) => {
  try {
    const { testName, suiteId } = req.body;
    
    if (!testName) {
      return res.status(400).json({ error: 'Test name is required' });
    }

    const suite = suiteId ? TEST_SUITES[suiteId as keyof typeof TEST_SUITES] : null;
    const testFile = suite?.file;

    const result = await runTests(testFile, testName);
    return res.json(result);
  } catch (error) {
    logger.error('Error running specific test:', error);
    return res.status(500).json({ error: 'Failed to run test' });
  }
});

// Test execution function
async function runTests(testFile?: string, testPattern?: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const args = [
      '--testPathPattern=integration',
      '--verbose',
      '--forceExit',
      '--json'
    ];

    // Add specific test file if provided
    if (testFile) {
      args.push(`--testPathPattern=integration.*${testFile}`);
    }

    // Add test name pattern if provided
    if (testPattern) {
      args.push(`--testNamePattern="${testPattern}"`);
    }

    // Set environment variables for tests
    const env = {
      ...process.env,
      NODE_ENV: 'test',
      DATABASE_URL: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
      JWT_SECRET: process.env.JWT_SECRET || 'test-jwt-secret'
    };

    logger.info('Starting test execution:', { testFile, testPattern, args });

    const jest = spawn('npx', ['jest', ...args], {
      cwd: process.cwd(),
      env,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    let jsonOutput = '';

    jest.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      
      // Try to extract JSON output
      const lines = output.split('\n');
      for (const line of lines) {
        if (line.trim().startsWith('{') && line.trim().endsWith('}')) {
          try {
            JSON.parse(line.trim());
            jsonOutput = line.trim();
          } catch (e) {
            // Not valid JSON, continue
          }
        }
      }
    });

    jest.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    jest.on('close', (code) => {
      logger.info('Test execution completed:', { code, hasJsonOutput: !!jsonOutput });

      try {
        // Try to parse Jest JSON output first
        if (jsonOutput) {
          const testResults = JSON.parse(jsonOutput);
          resolve({
            success: testResults.success,
            numPassedTests: testResults.numPassedTests,
            numFailedTests: testResults.numFailedTests,
            numTotalTests: testResults.numTotalTests,
            testResults: testResults.testResults,
            rawOutput: stdout,
            error: stderr || null,
            executionTime: testResults.executionTime || 0
          });
          return;
        }

        // Fallback: Parse text output
        const results = parseTestOutput(stdout, stderr, code || undefined);
        resolve(results);

      } catch (error) {
        logger.error('Error parsing test results:', error);
        reject({
          success: false,
          error: 'Failed to parse test results',
          rawOutput: stdout,
          stderr: stderr,
          exitCode: code
        });
      }
    });

    jest.on('error', (error) => {
      logger.error('Test process error:', error);
      reject({
        success: false,
        error: error.message,
        rawOutput: stdout,
        stderr: stderr
      });
    });
  });
}

// Parse Jest text output as fallback
function parseTestOutput(stdout: string, stderr: string, exitCode?: number) {
  const lines = stdout.split('\n');
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  const testResults: any[] = [];
  
  // Look for test result patterns
  for (const line of lines) {
    // Individual test results: ✓ or ✗
    if (line.includes('✓') || line.includes('✗')) {
      const isPass = line.includes('✓');
      const testName = line.replace(/.*[✓✗]\s*/, '').trim();
      
      if (testName) {
        testResults.push({
          title: testName,
          status: isPass ? 'passed' : 'failed',
          duration: 0
        });
        
        if (isPass) passedTests++;
        else failedTests++;
        totalTests++;
      }
    }

    // Summary lines
    if (line.includes('Tests:')) {
      const matches = line.match(/(\d+)\s*passed|(\d+)\s*failed|(\d+)\s*total/g);
      if (matches) {
        for (const match of matches) {
          if (match.includes('passed')) {
            passedTests = parseInt(match.match(/\d+/)?.[0] || '0');
          } else if (match.includes('failed')) {
            failedTests = parseInt(match.match(/\d+/)?.[0] || '0');
          } else if (match.includes('total')) {
            totalTests = parseInt(match.match(/\d+/)?.[0] || '0');
          }
        }
      }
    }
  }

  return {
    success: failedTests === 0 && totalTests > 0,
    numPassedTests: passedTests,
    numFailedTests: failedTests,
    numTotalTests: totalTests,
    testResults: testResults,
    rawOutput: stdout,
    error: stderr || null,
    executionTime: 0,
    exitCode: exitCode || 0
  };
}

export default router; 