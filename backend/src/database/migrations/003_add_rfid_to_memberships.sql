-- Migration: Add RFID tag field to customer memberships
-- This allows each membership to have its own RFID sticker for ESP32 relay triggering

-- Add rfid_tag column to customer_memberships table
ALTER TABLE customer_memberships 
ADD COLUMN IF NOT EXISTS rfid_tag VARCHAR(100) UNIQUE;

-- Create index for RFID tag lookups
CREATE INDEX IF NOT EXISTS idx_customer_memberships_rfid_tag ON customer_memberships(rfid_tag);

-- Add comment
COMMENT ON COLUMN customer_memberships.rfid_tag IS 'RFID tag identifier for ESP32 relay activation'; 