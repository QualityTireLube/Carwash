import { Pool } from 'pg';
import request from 'supertest';
import { db } from '../../config/database';

// Test database utilities
export class TestDatabase {
  static async clearAllTables(): Promise<void> {
    try {
      // Clear tables in reverse dependency order
      await db.query('DELETE FROM wash_sessions');
      await db.query('DELETE FROM customers');
      await db.query('DELETE FROM wash_types');
    } catch (error) {
      console.error('Error clearing test tables:', error);
      throw error;
    }
  }

  static async createTestCustomer(overrides: Partial<TestCustomer> = {}): Promise<TestCustomer> {
    const defaultCustomer = {
      name: 'Test Customer',
      email: `test${Date.now()}@example.com`,
      phone: '555-0123',
      membershipStatus: 'active'
    };

    const customerData = { ...defaultCustomer, ...overrides };

    const result = await db.query(
      `INSERT INTO customers (name, email, phone, membership_status)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, phone, rfid_tag as "rfidTag", membership_status as "membershipStatus", 
                 stripe_customer_id as "stripeCustomerId", stripe_subscription_id as "stripeSubscriptionId", 
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [customerData.name, customerData.email, customerData.phone, customerData.membershipStatus]
    );

    return result.rows[0];
  }

  static async createTestWashType(overrides: Partial<TestWashType> = {}): Promise<TestWashType> {
    const defaultWashType = {
      name: 'Test Wash',
      description: 'Test wash type',
      duration: 300,
      price: 9.99,
      relayId: 1
    };

    const washTypeData = { ...defaultWashType, ...overrides };

    const result = await db.query(
      `INSERT INTO wash_types (name, description, duration, price, relay_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, description, duration, price, relay_id as "relayId", 
                 is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"`,
      [washTypeData.name, washTypeData.description, washTypeData.duration, washTypeData.price, washTypeData.relayId]
    );

    return result.rows[0];
  }
}

// Test data interfaces
export interface TestCustomer {
  id?: string;
  name: string;
  email: string;
  phone?: string;
  rfidTag?: string;
  membershipStatus: 'active' | 'inactive' | 'pending';
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TestWashType {
  id?: string;
  name: string;
  description?: string;
  duration: number;
  price: number;
  relayId: number;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// API testing utilities
export class ApiTestHelper {
  static makePostRequest(app: any, endpoint: string, data: any) {
    return request(app)
      .post(endpoint)
      .send(data)
      .set('Content-Type', 'application/json');
  }

  static makeGetRequest(app: any, endpoint: string) {
    return request(app)
      .get(endpoint);
  }

  static makePutRequest(app: any, endpoint: string, data: any) {
    return request(app)
      .put(endpoint)
      .send(data)
      .set('Content-Type', 'application/json');
  }

  static makeDeleteRequest(app: any, endpoint: string) {
    return request(app)
      .delete(endpoint);
  }
}

// Common test data generators
export const generateTestCustomerData = (overrides: Partial<TestCustomer> = {}): Partial<TestCustomer> => {
  return {
    name: 'John Doe',
    email: `user${Date.now()}@example.com`,
    phone: '555-0123',
    membershipStatus: 'active',
    ...overrides
  };
};

export const generateInvalidCustomerData = () => ({
  invalidName: '',
  invalidEmail: 'not-an-email',
  invalidPhone: 'not-a-phone',
  invalidMembershipStatus: 'invalid-status'
}); 