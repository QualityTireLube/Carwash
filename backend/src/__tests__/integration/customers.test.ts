import request from 'supertest';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import customerRoutes from '../../routes/customers';
import { TestDatabase, generateTestCustomerData, generateInvalidCustomerData } from '../helpers/testUtils';
import { db } from '../../config/database';

// Create Express app for testing
const createTestApp = () => {
  const app = express();
  
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  
  // Add routes
  app.use('/api/customers', customerRoutes);
  
  return app;
};

describe('Customer Creation Integration Tests', () => {
  let app: express.Application;

  beforeAll(async () => {
    app = createTestApp();
  });

  beforeEach(async () => {
    await TestDatabase.clearAllTables();
  });

  afterAll(async () => {
    await TestDatabase.clearAllTables();
  });

  describe('POST /api/customers - Success Scenarios', () => {
    it('should create a customer with all required fields', async () => {
      const customerData = generateTestCustomerData({
        name: 'John Doe',
        email: 'john.doe@example.com',
        membershipStatus: 'active'
      });

      const response = await request(app)
        .post('/api/customers')
        .send(customerData)
        .expect(201);

      expect(response.body).toHaveProperty('customer');
      expect(response.body.customer).toMatchObject({
        name: customerData.name,
        email: customerData.email,
        membershipStatus: customerData.membershipStatus,
        phone: customerData.phone
      });
      expect(response.body.customer).toHaveProperty('id');
      expect(response.body.customer).toHaveProperty('createdAt');
      expect(response.body.customer).toHaveProperty('updatedAt');
    });

    it('should create a customer with minimal required fields only', async () => {
      const customerData = {
        name: 'Jane Smith',
        email: 'jane.smith@example.com',
        membershipStatus: 'inactive'
      };

      const response = await request(app)
        .post('/api/customers')
        .send(customerData)
        .expect(201);

      expect(response.body.customer).toMatchObject({
        name: customerData.name,
        email: customerData.email,
        membershipStatus: customerData.membershipStatus,
        phone: null,
        rfidTag: null
      });
    });

    it('should create a customer with all optional fields', async () => {
      const customerData = generateTestCustomerData({
        name: 'Bob Wilson',
        email: 'bob.wilson@example.com',
        phone: '555-0987',
        rfidTag: 'RFID123456',
        membershipStatus: 'pending'
      });

      const response = await request(app)
        .post('/api/customers')
        .send(customerData)
        .expect(201);

      expect(response.body.customer).toMatchObject({
        name: customerData.name,
        email: customerData.email,
        phone: customerData.phone,
        rfidTag: customerData.rfidTag,
        membershipStatus: customerData.membershipStatus
      });
    });

    it('should create multiple customers with different email addresses', async () => {
      const customer1Data = generateTestCustomerData({
        name: 'Customer One',
        email: 'customer1@example.com'
      });

      const customer2Data = generateTestCustomerData({
        name: 'Customer Two',
        email: 'customer2@example.com'
      });

      const response1 = await request(app)
        .post('/api/customers')
        .send(customer1Data)
        .expect(201);

      const response2 = await request(app)
        .post('/api/customers')
        .send(customer2Data)
        .expect(201);

      expect(response1.body.customer.id).not.toBe(response2.body.customer.id);
      expect(response1.body.customer.email).toBe(customer1Data.email);
      expect(response2.body.customer.email).toBe(customer2Data.email);
    });

    it('should persist customer data to database correctly', async () => {
      const customerData = generateTestCustomerData({
        name: 'Database Test Customer',
        email: 'dbtest@example.com',
        phone: '555-DB-TEST'
      });

      const response = await request(app)
        .post('/api/customers')
        .send(customerData)
        .expect(201);

      const customerId = response.body.customer.id;

      // Verify data was saved to database
      const dbResult = await db.query(
        'SELECT * FROM customers WHERE id = $1',
        [customerId]
      );

      expect(dbResult.rows).toHaveLength(1);
      expect(dbResult.rows[0]).toMatchObject({
        id: customerId,
        name: customerData.name,
        email: customerData.email,
        phone: customerData.phone,
        membership_status: customerData.membershipStatus
      });
    });
  });

  describe('POST /api/customers - Validation Error Scenarios', () => {
    it('should return 400 when name is missing', async () => {
      const customerData = {
        email: 'test@example.com',
        membershipStatus: 'active'
      };

      const response = await request(app)
        .post('/api/customers')
        .send(customerData)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors).toContainEqual(
        expect.objectContaining({
          msg: 'Name is required',
          path: 'name'
        })
      );
    });

    it('should return 400 when name is empty string', async () => {
      const customerData = {
        name: '',
        email: 'test@example.com',
        membershipStatus: 'active'
      };

      const response = await request(app)
        .post('/api/customers')
        .send(customerData)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors).toContainEqual(
        expect.objectContaining({
          msg: 'Name is required'
        })
      );
    });

    it('should return 400 when name is only whitespace', async () => {
      const customerData = {
        name: '   ',
        email: 'test@example.com',
        membershipStatus: 'active'
      };

      const response = await request(app)
        .post('/api/customers')
        .send(customerData)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });

    it('should return 400 when email is missing', async () => {
      const customerData = {
        name: 'Test Customer',
        membershipStatus: 'active'
      };

      const response = await request(app)
        .post('/api/customers')
        .send(customerData)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors).toContainEqual(
        expect.objectContaining({
          msg: 'Valid email is required',
          path: 'email'
        })
      );
    });

    it('should return 400 when email format is invalid', async () => {
      const customerData = {
        name: 'Test Customer',
        email: 'invalid-email-format',
        membershipStatus: 'active'
      };

      const response = await request(app)
        .post('/api/customers')
        .send(customerData)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors).toContainEqual(
        expect.objectContaining({
          msg: 'Valid email is required'
        })
      );
    });

    it('should return 400 when membershipStatus is invalid', async () => {
      const customerData = {
        name: 'Test Customer',
        email: 'test@example.com',
        membershipStatus: 'invalid-status'
      };

      const response = await request(app)
        .post('/api/customers')
        .send(customerData)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors).toContainEqual(
        expect.objectContaining({
          msg: 'Invalid membership status'
        })
      );
    });

    it('should return 400 when phone number format is invalid', async () => {
      const customerData = {
        name: 'Test Customer',
        email: 'test@example.com',
        phone: 'not-a-phone-number',
        membershipStatus: 'active'
      };

      const response = await request(app)
        .post('/api/customers')
        .send(customerData)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors).toContainEqual(
        expect.objectContaining({
          msg: 'Valid phone number required'
        })
      );
    });

    it('should return 400 with multiple validation errors', async () => {
      const customerData = {
        name: '',
        email: 'invalid-email',
        phone: 'invalid-phone',
        membershipStatus: 'invalid-status'
      };

      const response = await request(app)
        .post('/api/customers')
        .send(customerData)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors).toHaveLength(4);
    });
  });

  describe('POST /api/customers - Database Constraint Scenarios', () => {
    it('should return 500 when trying to create customer with duplicate email', async () => {
      const customerData = generateTestCustomerData({
        email: 'duplicate@example.com'
      });

      // Create first customer
      await request(app)
        .post('/api/customers')
        .send(customerData)
        .expect(201);

      // Try to create second customer with same email
      const response = await request(app)
        .post('/api/customers')
        .send({
          ...customerData,
          name: 'Different Name'
        })
        .expect(500);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Failed to create customer');
    });

    it('should return 500 when trying to create customer with duplicate RFID tag', async () => {
      const customerData1 = generateTestCustomerData({
        email: 'customer1@example.com',
        rfidTag: 'DUPLICATE_RFID'
      });

      const customerData2 = generateTestCustomerData({
        email: 'customer2@example.com',
        rfidTag: 'DUPLICATE_RFID'
      });

      // Create first customer
      await request(app)
        .post('/api/customers')
        .send(customerData1)
        .expect(201);

      // Try to create second customer with same RFID tag
      const response = await request(app)
        .post('/api/customers')
        .send(customerData2)
        .expect(500);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Failed to create customer');
    });
  });

  describe('POST /api/customers - Edge Cases', () => {
    it('should handle very long names correctly', async () => {
      const longName = 'A'.repeat(255);
      const customerData = generateTestCustomerData({
        name: longName,
        email: 'longname@example.com'
      });

      const response = await request(app)
        .post('/api/customers')
        .send(customerData)
        .expect(201);

      expect(response.body.customer.name).toBe(longName);
    });

    it('should trim whitespace from name field', async () => {
      const customerData = generateTestCustomerData({
        name: '  Trimmed Name  ',
        email: 'trimmed@example.com'
      });

      const response = await request(app)
        .post('/api/customers')
        .send(customerData)
        .expect(201);

      expect(response.body.customer.name).toBe('Trimmed Name');
    });

    it('should handle special characters in name', async () => {
      const customerData = generateTestCustomerData({
        name: 'José María O\'Connor-Smith',
        email: 'special@example.com'
      });

      const response = await request(app)
        .post('/api/customers')
        .send(customerData)
        .expect(201);

      expect(response.body.customer.name).toBe('José María O\'Connor-Smith');
    });

    it('should create customer without phone number', async () => {
      const customerData = {
        name: 'No Phone Customer',
        email: 'nophone@example.com',
        membershipStatus: 'active'
      };

      const response = await request(app)
        .post('/api/customers')
        .send(customerData)
        .expect(201);

      expect(response.body.customer.phone).toBeNull();
    });

    it('should create customer without RFID tag', async () => {
      const customerData = {
        name: 'No RFID Customer',
        email: 'norfid@example.com',
        membershipStatus: 'active'
      };

      const response = await request(app)
        .post('/api/customers')
        .send(customerData)
        .expect(201);

      expect(response.body.customer.rfidTag).toBeNull();
    });

    it('should handle all valid membership statuses', async () => {
      const statuses = ['active', 'inactive', 'pending'];
      
      for (const status of statuses) {
        const customerData = generateTestCustomerData({
          email: `${status}@example.com`,
          membershipStatus: status as 'active' | 'inactive' | 'pending'
        });

        const response = await request(app)
          .post('/api/customers')
          .send(customerData)
          .expect(201);

        expect(response.body.customer.membershipStatus).toBe(status);
      }
    });
  });
}); 