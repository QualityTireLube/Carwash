const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Helper function to handle API responses
async function handleResponse(response: Response) {
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error: ${response.status} - ${errorText}`);
  }
  return response.json();
}

// Helper function to make API requests with retry logic
async function apiRequest(url: string, options: RequestInit = {}, retries = 1): Promise<any> {
  // Check if we're in production and don't have a proper API URL
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production' && !process.env.NEXT_PUBLIC_API_URL) {
    console.warn('No API URL configured in production. Please set NEXT_PUBLIC_API_URL environment variable.');
    throw new Error('API not configured');
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    return await handleResponse(response);
  } catch (error) {
    if (retries > 0) {
      console.warn(`API request failed, retrying... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, 2000)); // Increased from 1s to 2s to reduce request rate
      return apiRequest(url, options, retries - 1);
    }
    throw error;
  }
}

export async function triggerRelay(relayId: number): Promise<string> {
  try {
    const response = await apiRequest(`${API_BASE_URL}/api/trigger/${relayId}`, { 
      method: 'POST' 
    });
    return response.message || 'Relay triggered successfully';
  } catch (error) {
    console.warn('Relay trigger failed:', error);
    throw new Error('Unable to trigger relay - ESP32 may be offline');
  }
}

export async function getSystemStatus() {
  try {
    // Don't use retry logic for ESP32 status since failures are expected when offline
    const response = await fetch(`${API_BASE_URL}/api/trigger/status`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (response.ok) {
      return await response.json();
    } else if (response.status === 503) {
      // 503 is expected when ESP32 is offline - handle gracefully
      const data = await response.json();
      return { success: false, error: 'ESP32 not reachable', offline: true, ...data };
    } else {
      throw new Error(`API Error: ${response.status}`);
    }
  } catch (error) {
    console.debug('ESP32 status check failed (expected if hardware is offline):', error);
    return { success: false, error: 'ESP32 not reachable', offline: true };
  }
}

export async function testConnection() {
  try {
    // Don't use retry logic for ESP32 test since 503 is expected when offline
    const response = await fetch(`${API_BASE_URL}/api/trigger/test`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (response.ok) {
      return await response.json();
    } else if (response.status === 503) {
      // 503 is expected when ESP32 is offline - handle gracefully
      const data = await response.json();
      return { success: false, error: 'ESP32 not reachable', offline: true, ...data };
    } else {
      throw new Error(`API Error: ${response.status}`);
    }
  } catch (error) {
    // Handle ESP32 connectivity issues gracefully - this is expected when hardware is offline
    console.debug('ESP32 connection test failed (expected if hardware is offline):', error);
    return { success: false, error: 'ESP32 not reachable', offline: true };
  }
}

// Enhanced ESP32 diagnostic function
export async function diagnoseEsp32Connection() {
  const results = {
    testEndpoint: null as any,
    statusEndpoint: null as any,
    queueEndpoint: null as any,
    pollEndpoint: null as any,
    timestamp: new Date().toISOString(),
    summary: {
      overall: 'unknown' as 'online' | 'offline' | 'unknown',
      issues: [] as string[]
    }
  };

  try {
    // Test /api/trigger/test endpoint
    const testResponse = await fetch(`${API_BASE_URL}/api/trigger/test`);
    results.testEndpoint = {
      status: testResponse.status,
      ok: testResponse.ok,
      data: testResponse.ok ? await testResponse.json() : await testResponse.text()
    };
  } catch (error) {
    results.testEndpoint = { error: (error as Error).message };
    results.summary.issues.push('Test endpoint unreachable');
  }

  try {
    // Test /api/trigger/status endpoint
    const statusResponse = await fetch(`${API_BASE_URL}/api/trigger/status`);
    results.statusEndpoint = {
      status: statusResponse.status,
      ok: statusResponse.ok,
      data: statusResponse.ok ? await statusResponse.json() : await statusResponse.text()
    };
  } catch (error) {
    results.statusEndpoint = { error: (error as Error).message };
    results.summary.issues.push('Status endpoint unreachable');
  }

  try {
    // Test /api/trigger/queue endpoint (for debugging)
    const queueResponse = await fetch(`${API_BASE_URL}/api/trigger/queue`);
    results.queueEndpoint = {
      status: queueResponse.status,
      ok: queueResponse.ok,
      data: queueResponse.ok ? await queueResponse.json() : await queueResponse.text()
    };
  } catch (error) {
    results.queueEndpoint = { error: (error as Error).message };
    results.summary.issues.push('Queue endpoint unreachable');
  }

  try {
    // Test /api/trigger/poll endpoint (what ESP32 uses)
    const pollResponse = await fetch(`${API_BASE_URL}/api/trigger/poll`);
    results.pollEndpoint = {
      status: pollResponse.status,
      ok: pollResponse.ok,
      data: pollResponse.ok ? await pollResponse.json() : await pollResponse.text()
    };
  } catch (error) {
    results.pollEndpoint = { error: (error as Error).message };
    results.summary.issues.push('Poll endpoint unreachable');
  }

  // Determine overall status
  const testSuccess = results.testEndpoint?.ok && results.testEndpoint?.data?.success;
  const statusSuccess = results.statusEndpoint?.ok;
  const hasRecentPoll = results.queueEndpoint?.data?.esp32Online;

  if (testSuccess && statusSuccess && hasRecentPoll) {
    results.summary.overall = 'online';
  } else if (results.testEndpoint?.status === 503 || results.statusEndpoint?.status === 503) {
    results.summary.overall = 'offline';
    results.summary.issues.push('Backend reports ESP32 offline (no recent polling activity)');
  } else {
    results.summary.overall = 'unknown';
    results.summary.issues.push('Unable to determine ESP32 status');
  }

  return results;
}

export async function getCustomers() {
  try {
    return await apiRequest(`${API_BASE_URL}/api/customers`);
  } catch (error) {
    console.error('Error fetching customers:', error);
    return { customers: [] };
  }
}

export async function getWashTypes() {
  try {
    return await apiRequest(`${API_BASE_URL}/api/wash-types`);
  } catch (error) {
    console.error('Error fetching wash types:', error);
    return { washTypes: [] };
  }
}

export async function getCustomer(id: string) {
  try {
    return await apiRequest(`${API_BASE_URL}/api/customers/${id}`);
  } catch (error) {
    console.error('Error fetching customer:', error);
    throw error;
  }
}

export async function createCustomer(customerData: any) {
  return await apiRequest(`${API_BASE_URL}/api/customers`, {
    method: 'POST',
    body: JSON.stringify(customerData),
  });
}

export async function updateCustomer(id: string, customerData: any) {
  return await apiRequest(`${API_BASE_URL}/api/customers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(customerData),
  });
}

export async function deleteCustomer(id: string) {
  return await apiRequest(`${API_BASE_URL}/api/customers/${id}`, {
    method: 'DELETE',
  });
}

export async function getWashType(id: string) {
  try {
    return await apiRequest(`${API_BASE_URL}/api/wash-types/${id}`);
  } catch (error) {
    console.error('Error fetching wash type:', error);
    throw error;
  }
}

export async function createWashType(washTypeData: any) {
  return await apiRequest(`${API_BASE_URL}/api/wash-types`, {
    method: 'POST',
    body: JSON.stringify(washTypeData),
  });
}

export async function updateWashType(id: string, washTypeData: any) {
  return await apiRequest(`${API_BASE_URL}/api/wash-types/${id}`, {
    method: 'PUT',
    body: JSON.stringify(washTypeData),
  });
}

export async function deleteWashType(id: string) {
  return await apiRequest(`${API_BASE_URL}/api/wash-types/${id}`, {
    method: 'DELETE',
  });
}

// Wash Sessions API
export async function getWashSessions(params?: { status?: string; customerId?: string; limit?: number; offset?: number }) {
  try {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.append('status', params.status);
    if (params?.customerId) searchParams.append('customerId', params.customerId);
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.offset) searchParams.append('offset', params.offset.toString());
    
    const url = `${API_BASE_URL}/api/wash-sessions${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
    return await apiRequest(url);
  } catch (error) {
    console.error('Error fetching wash sessions:', error);
    return { sessions: [] };
  }
}

export async function getActiveWashSessions() {
  try {
    return await apiRequest(`${API_BASE_URL}/api/wash-sessions/active`);
  } catch (error) {
    console.error('Error fetching active wash sessions:', error);
    return { activeSessions: [] };
  }
}

export async function startWashSession(customerId: string, washTypeId: string, notes?: string) {
  return await apiRequest(`${API_BASE_URL}/api/wash-sessions/start`, {
    method: 'POST',
    body: JSON.stringify({ customerId, washTypeId, notes }),
  });
}

export async function completeWashSession(sessionId: string, notes?: string) {
  return await apiRequest(`${API_BASE_URL}/api/wash-sessions/${sessionId}/complete`, {
    method: 'PUT',
    body: JSON.stringify({ notes }),
  });
}

export async function cancelWashSession(sessionId: string, reason?: string) {
  return await apiRequest(`${API_BASE_URL}/api/wash-sessions/${sessionId}/cancel`, {
    method: 'PUT',
    body: JSON.stringify({ reason }),
  });
}

export async function getCustomerWashSessions(customerId: string, limit?: number) {
  try {
    const url = `${API_BASE_URL}/api/wash-sessions/customer/${customerId}${limit ? `?limit=${limit}` : ''}`;
    return await apiRequest(url);
  } catch (error) {
    console.error('Error fetching customer wash sessions:', error);
    return { sessions: [] };
  }
}

// Customer Memberships API
export async function getCustomerMemberships(customerId: string) {
  try {
    return await apiRequest(`${API_BASE_URL}/api/memberships/customer/${customerId}`);
  } catch (error) {
    console.error('Error fetching customer memberships:', error);
    return { memberships: [] };
  }
}

export async function getWashTypeMemberships(washTypeId: string) {
  try {
    return await apiRequest(`${API_BASE_URL}/api/memberships/wash-type/${washTypeId}`);
  } catch (error) {
    console.error('Error fetching wash type memberships:', error);
    return { memberships: [] };
  }
}

export async function createMembership(membershipData: {
  customerId: string;
  washTypeId: string;
  status?: string;
  billingCycle?: string;
  price?: number;
  endDate?: string;
  notes?: string;
  rfidTag?: string;
}) {
  return await apiRequest(`${API_BASE_URL}/api/memberships`, {
    method: 'POST',
    body: JSON.stringify(membershipData),
  });
}

// Test Runner API functions
export async function getTestSuites() {
  return await apiRequest(`${API_BASE_URL}/api/test-runner/suites`);
}

export async function runAllTests() {
  return await apiRequest(`${API_BASE_URL}/api/test-runner/run-all`, {
    method: 'POST',
  });
}

export async function runTestSuite(suiteId: string) {
  return await apiRequest(`${API_BASE_URL}/api/test-runner/run-suite/${suiteId}`, {
    method: 'POST',
  });
}

export async function runSpecificTest(testName: string, suiteId?: string) {
  return await apiRequest(`${API_BASE_URL}/api/test-runner/run-test`, {
    method: 'POST',
    body: JSON.stringify({ testName, suiteId }),
  });
}

export async function updateMembership(membershipId: string, updateData: {
  status?: string;
  endDate?: string;
  notes?: string;
  price?: number;
}) {
  return await apiRequest(`${API_BASE_URL}/api/memberships/${membershipId}`, {
    method: 'PUT',
    body: JSON.stringify(updateData),
  });
}

export async function deleteMembership(membershipId: string) {
  return await apiRequest(`${API_BASE_URL}/api/memberships/${membershipId}`, {
    method: 'DELETE',
  });
}

export async function getMembership(membershipId: string) {
  try {
    return await apiRequest(`${API_BASE_URL}/api/memberships/${membershipId}`);
  } catch (error) {
    console.error('Error fetching membership:', error);
    throw error;
  }
} 

// Utility function to safely format price values
export const formatPrice = (price: any): string => {
  if (price && !isNaN(Number(price))) {
    return Number(price).toFixed(2);
  }
  return '0.00';
}; 