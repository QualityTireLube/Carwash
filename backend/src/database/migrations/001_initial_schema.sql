-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    rfid_tag VARCHAR(100) UNIQUE,
    membership_status VARCHAR(20) DEFAULT 'inactive' CHECK (membership_status IN ('active', 'inactive', 'pending')),
    stripe_customer_id VARCHAR(255) UNIQUE,
    stripe_subscription_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create wash_types table
CREATE TABLE IF NOT EXISTS wash_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    duration INTEGER NOT NULL CHECK (duration > 0), -- Duration in seconds
    price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    relay_id INTEGER NOT NULL CHECK (relay_id >= 1 AND relay_id <= 4),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create wash_sessions table for tracking wash usage
CREATE TABLE IF NOT EXISTS wash_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    wash_type_id UUID REFERENCES wash_types(id) ON DELETE SET NULL,
    relay_id INTEGER NOT NULL CHECK (relay_id >= 1 AND relay_id <= 5),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled', 'error')),
    notes TEXT
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_rfid_tag ON customers(rfid_tag);
CREATE INDEX IF NOT EXISTS idx_customers_membership_status ON customers(membership_status);
CREATE INDEX IF NOT EXISTS idx_wash_types_relay_id ON wash_types(relay_id);
CREATE INDEX IF NOT EXISTS idx_wash_types_active ON wash_types(is_active);
CREATE INDEX IF NOT EXISTS idx_wash_sessions_customer_id ON wash_sessions(customer_id);
CREATE INDEX IF NOT EXISTS idx_wash_sessions_started_at ON wash_sessions(started_at);

-- Insert default wash types
INSERT INTO wash_types (name, description, duration, price, relay_id) VALUES
    ('Ultimate Wash', 'Complete wash with all services and detailing', 300, 24.99, 1),
    ('Premium Wash', 'Basic wash plus tire cleaning and wax', 180, 9.99, 2),
    ('Express Wash', 'Soap, rinse, and basic dry', 150, 7.99, 3),
    ('Basic Wash', 'Exterior wash with soap and rinse', 120, 5.99, 4)
ON CONFLICT (name) DO NOTHING; 