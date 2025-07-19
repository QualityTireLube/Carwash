-- Migration: Add Customer Memberships table
-- This allows customers to have memberships for specific wash types

-- Create customer_memberships table
CREATE TABLE IF NOT EXISTS customer_memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    wash_type_id UUID NOT NULL REFERENCES wash_types(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'expired', 'suspended')),
    start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_date TIMESTAMP WITH TIME ZONE,
    billing_cycle VARCHAR(20) DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'quarterly', 'annual', 'lifetime')),
    price DECIMAL(10,2),
    stripe_subscription_id VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_customer_memberships_customer_id ON customer_memberships(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_memberships_wash_type_id ON customer_memberships(wash_type_id);
CREATE INDEX IF NOT EXISTS idx_customer_memberships_status ON customer_memberships(status);
CREATE INDEX IF NOT EXISTS idx_customer_memberships_dates ON customer_memberships(start_date, end_date);

-- Create unique constraint to prevent duplicate active memberships for same customer-wash type combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_memberships_unique_active 
ON customer_memberships(customer_id, wash_type_id) 
WHERE status = 'active';

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_customer_memberships_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_customer_memberships_updated_at
    BEFORE UPDATE ON customer_memberships
    FOR EACH ROW
    EXECUTE FUNCTION update_customer_memberships_updated_at(); 