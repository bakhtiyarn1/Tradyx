-- Tradyx Database Initialization Script
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

-- =====================================================
-- INVESTMENTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS investments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL,
    amount          DECIMAL(18, 8) NOT NULL,
    daily_rate      DECIMAL(10, 6) NOT NULL,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    next_payout_at  TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    
    -- Foreign key to users
    CONSTRAINT fk_investments_user 
        FOREIGN KEY (user_id) 
        REFERENCES users(id) 
        ON DELETE CASCADE,
    
    -- Ensure positive amounts
    CONSTRAINT chk_investments_amount_positive 
        CHECK (amount > 0),
    
    -- Ensure valid daily rate (0.8% to 1.7%)
    CONSTRAINT chk_investments_daily_rate_valid 
        CHECK (daily_rate >= 0.008 AND daily_rate <= 0.017)
);

-- Indexes for investments
CREATE INDEX IF NOT EXISTS idx_investments_user_id 
    ON investments (user_id);

CREATE INDEX IF NOT EXISTS idx_investments_is_active 
    ON investments (is_active) 
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_investments_next_payout 
    ON investments (next_payout_at) 
    WHERE is_active = true;

-- Comments
COMMENT ON TABLE investments IS 'User investments with daily interest payouts';
COMMENT ON COLUMN investments.daily_rate IS 'Daily interest rate (e.g., 0.008 = 0.8%)';
COMMENT ON COLUMN investments.next_payout_at IS 'Next scheduled interest payout time';
