const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function triggerRelay(relayId: number): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/api/trigger/${relayId}`, { 
    method: 'POST' 
  });
  return await res.text();
}

export async function getSystemStatus() {
  const res = await fetch(`${API_BASE_URL}/api/trigger/status`);
  return await res.json();
}

export async function testConnection() {
  const res = await fetch(`${API_BASE_URL}/api/trigger/test`);
  return await res.json();
}

export async function getCustomers() {
  const res = await fetch(`${API_BASE_URL}/api/customers`);
  return await res.json();
}

export async function getWashTypes() {
  const res = await fetch(`${API_BASE_URL}/api/wash-types`);
  return await res.json();
}

export async function createCustomer(customerData: any) {
  const res = await fetch(`${API_BASE_URL}/api/customers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(customerData),
  });
  return await res.json();
}

export async function createWashType(washTypeData: any) {
  const res = await fetch(`${API_BASE_URL}/api/wash-types`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(washTypeData),
  });
  return await res.json();
} 