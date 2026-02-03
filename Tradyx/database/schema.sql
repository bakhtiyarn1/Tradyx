-- Tradyx Database Schema
-- PostgreSQL 15+

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username        VARCHAR(50) NOT NULL,
    email           VARCHAR(255) NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    balance         DECIMAL(18, 8) NOT NULL DEFAULT 0,
    referrer_id     UUID NULL,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Self-referencing foreign key for referral system
    CONSTRAINT fk_users_referrer 
        FOREIGN KEY (referrer_id) 
        REFERENCES users(id) 
        ON DELETE SET NULL,
    
    -- Ensure balance is never negative
    CONSTRAINT chk_users_balance_non_negative 
        CHECK (balance >= 0)
);

-- Unique indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username 
    ON users (username);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email 
    ON users (LOWER(email));

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_users_referrer_id 
    ON users (referrer_id) 
    WHERE referrer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_created_at 
    ON users (created_at DESC);

-- Comments for documentation
COMMENT ON TABLE users IS 'User accounts for the Tradyx investment platform';
COMMENT ON COLUMN users.id IS 'Unique identifier for the user';
COMMENT ON COLUMN users.username IS 'Unique username for login';
COMMENT ON COLUMN users.email IS 'Unique email address (stored lowercase)';
COMMENT ON COLUMN users.password_hash IS 'BCrypt hashed password';
COMMENT ON COLUMN users.balance IS 'User account balance with 8 decimal precision';
COMMENT ON COLUMN users.referrer_id IS 'ID of the user who referred this user';
COMMENT ON COLUMN users.created_at IS 'Timestamp when the user was created';
