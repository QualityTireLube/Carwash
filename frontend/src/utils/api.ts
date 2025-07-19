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
async function apiRequest(url: string, options: RequestInit = {}, retries = 2): Promise<any> {
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
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
      return apiRequest(url, options, retries - 1);
    }
    throw error;
  }
}

export async function triggerRelay(relayId: number): Promise<string> {
  const response = await apiRequest(`${API_BASE_URL}/api/trigger/${relayId}`, { 
    method: 'POST' 
  });
  return response.message || 'Relay triggered successfully';
}

export async function getSystemStatus() {
  return await apiRequest(`${API_BASE_URL}/api/trigger/status`);
}

export async function testConnection() {
  try {
    return await apiRequest(`${API_BASE_URL}/api/trigger/test`);
  } catch (error) {
    console.warn('ESP32 connection test failed:', error);
    return { success: false, error: 'ESP32 not reachable' };
  }
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

export async function createCustomer(customerData: any) {
  return await apiRequest(`${API_BASE_URL}/api/customers`, {
    method: 'POST',
    body: JSON.stringify(customerData),
  });
}

export async function createWashType(washTypeData: any) {
  return await apiRequest(`${API_BASE_URL}/api/wash-types`, {
    method: 'POST',
    body: JSON.stringify(washTypeData),
  });
} 