-- Tradyx Database Schema

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    balance DECIMAL(18,2) NOT NULL DEFAULT 0.00 CHECK (balance >= 0),
    referrer_id UUID REFERENCES users(id),
    invite_code VARCHAR(8) NOT NULL DEFAULT '' UNIQUE,
    referral_path TEXT,
    status INT NOT NULL DEFAULT 0,
    personal_turnover DECIMAL(18,2) NOT NULL DEFAULT 0.00,
    team_turnover DECIMAL(18,2) NOT NULL DEFAULT 0.00,
    telegram_id BIGINT UNIQUE,
    registration_ip VARCHAR(45),
    is_suspicious BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);
CREATE INDEX IF NOT EXISTS idx_users_referrer ON users (referrer_id);
CREATE INDEX IF NOT EXISTS idx_users_invite_code ON users (invite_code) WHERE invite_code != '';

COMMENT ON TABLE users IS 'Platform users';
COMMENT ON COLUMN users.balance IS 'Current account balance in USD';
COMMENT ON COLUMN users.status IS '0=Bronze, 1=Silver, 2=Gold, 3=Platinum';

-- Investments table
CREATE TABLE IF NOT EXISTS investments (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    amount DECIMAL(18,2) NOT NULL,
    daily_rate DECIMAL(8,4) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    next_payout_at TIMESTAMP NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    remaining_payouts INT NOT NULL DEFAULT 30
);

CREATE INDEX IF NOT EXISTS idx_investments_user ON investments (user_id);
CREATE INDEX IF NOT EXISTS idx_investments_active ON investments (is_active, next_payout_at);
CREATE INDEX IF NOT EXISTS idx_investments_active_payouts ON investments (is_active, remaining_payouts) WHERE is_active = true AND remaining_payouts > 0;

-- Investment Plans table (admin-managed)
CREATE TABLE IF NOT EXISTS investment_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    min_amount DECIMAL(18,2) NOT NULL,
    max_amount DECIMAL(18,2) NOT NULL,
    daily_rate DECIMAL(8,4) NOT NULL,
    duration_days INT NOT NULL DEFAULT 30,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INT NOT NULL DEFAULT 0,
    description TEXT NOT NULL DEFAULT '',
    color VARCHAR(20) NOT NULL DEFAULT 'blue',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plans_active ON investment_plans (is_active, sort_order);

-- Seed default plans (idempotent)
INSERT INTO investment_plans (name, min_amount, max_amount, daily_rate, duration_days, sort_order, description, color)
SELECT * FROM (VALUES
    ('Starter',   20.00,    99.99, 0.0050,  45, 1, 'Low entry, steady growth — 22.5% total ROI over 45 days', 'blue'),
    ('Growth',   100.00,   499.99, 0.0065,  60, 2, 'Balanced risk & reward — 39% total ROI over 60 days', 'purple'),
    ('Premium',  500.00,  1999.99, 0.0075,  90, 3, 'Higher returns, longer term — 67.5% total ROI over 90 days', 'cyan'),
    ('Elite',   2000.00, 999999.00, 0.0085, 120, 4, 'Maximum potential — 102% total ROI over 120 days', 'green')
) AS v(name, min_amount, max_amount, daily_rate, duration_days, sort_order, description, color)
WHERE NOT EXISTS (SELECT 1 FROM investment_plans LIMIT 1);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    amount DECIMAL(18,2) NOT NULL,
    type VARCHAR(50) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'Completed',
    fee_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
    is_instant BOOLEAN NOT NULL DEFAULT false,
    wallet_address VARCHAR(200),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_transactions_type_valid CHECK (type IN ('Deposit', 'Withdrawal', 'Investment', 'Profit', 'ReferralBonus', 'ManualAdjustment', 'Cashback', 'InsuranceFee')),
    CONSTRAINT chk_transactions_status_valid CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Completed'))
);

CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions (type);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_pending ON transactions (status, type) WHERE status = 'Pending' AND type = 'Withdrawal';

COMMENT ON COLUMN transactions.status IS 'Pending/Approved/Rejected/Completed — used for Withdrawal queue';
COMMENT ON COLUMN transactions.fee_amount IS 'Fee charged for instant withdrawals';
COMMENT ON COLUMN transactions.is_instant IS 'True if user chose instant withdrawal';

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications (user_id, is_read) WHERE is_read = false;

-- Referral Transactions log
CREATE TABLE IF NOT EXISTS referral_transactions (
    id UUID PRIMARY KEY,
    recipient_id UUID NOT NULL REFERENCES users(id),
    source_user_id UUID NOT NULL REFERENCES users(id),
    level INT NOT NULL CHECK (level BETWEEN 1 AND 3),
    amount DECIMAL(18,2) NOT NULL,
    rate DECIMAL(8,4) NOT NULL,
    source_amount DECIMAL(18,2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_tx_recipient ON referral_transactions (recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referral_tx_source ON referral_transactions (source_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_tx_level ON referral_transactions (recipient_id, level);

-- User Rank History log
CREATE TABLE IF NOT EXISTS user_rank_history (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    old_rank INT NOT NULL,
    new_rank INT NOT NULL,
    personal_turnover DECIMAL(18,2) NOT NULL,
    team_turnover DECIMAL(18,2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rank_history_user ON user_rank_history (user_id, created_at DESC);

-- ============================================================
-- MIGRATIONS (idempotent, safe to run multiple times)
-- ============================================================

-- Backfill invite_code
UPDATE users SET invite_code = UPPER(SUBSTR(REPLACE(gen_random_uuid()::text, '-', ''), 1, 8))
WHERE invite_code = '' OR invite_code IS NULL;

-- Backfill referral_path
WITH RECURSIVE chain AS (
    SELECT id, referrer_id, NULL::text AS referral_path FROM users WHERE referrer_id IS NULL
    UNION ALL
    SELECT u.id, u.referrer_id,
           CASE WHEN c.referral_path IS NULL THEN c.id::text ELSE c.referral_path || '/' || c.id::text END
    FROM users u JOIN chain c ON u.referrer_id = c.id
)
UPDATE users u SET referral_path = c.referral_path
FROM chain c WHERE u.id = c.id AND c.referral_path IS NOT NULL
  AND (u.referral_path IS NULL OR u.referral_path != c.referral_path);

-- Backfill personal_turnover from existing investments
UPDATE users u SET personal_turnover = sub.total
FROM (SELECT user_id, COALESCE(SUM(amount), 0) AS total FROM investments GROUP BY user_id) sub
WHERE u.id = sub.user_id AND u.personal_turnover = 0 AND sub.total > 0;

-- Backfill team_turnover
WITH RECURSIVE team AS (
    SELECT referrer_id AS root_id, id AS member_id, 1 AS lvl FROM users WHERE referrer_id IS NOT NULL
    UNION ALL
    SELECT t.root_id, u.id, t.lvl + 1
    FROM users u JOIN team t ON u.referrer_id = t.member_id WHERE t.lvl < 3
)
UPDATE users u SET team_turnover = sub.total
FROM (
    SELECT t.root_id, COALESCE(SUM(m.personal_turnover), 0) AS total
    FROM team t JOIN users m ON m.id = t.member_id GROUP BY t.root_id
) sub
WHERE u.id = sub.root_id AND sub.total > 0 AND u.team_turnover = 0;

-- Backfill existing transactions with status = 'Completed' (for old rows without status)
UPDATE transactions SET status = 'Completed' WHERE status IS NULL OR status = '';

-- Add remaining_payouts column if not exists (migration for existing DB)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'investments' AND column_name = 'remaining_payouts') THEN
        ALTER TABLE investments ADD COLUMN remaining_payouts INT NOT NULL DEFAULT 30;
    END IF;
END $$;

-- Backfill remaining_payouts for existing active investments (default 30)
UPDATE investments SET remaining_payouts = 30
WHERE is_active = true AND remaining_payouts = 0;

-- Add telegram_id column (migration for existing DB)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'telegram_id') THEN
        ALTER TABLE users ADD COLUMN telegram_id BIGINT UNIQUE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_telegram ON users (telegram_id) WHERE telegram_id IS NOT NULL;

-- Add anti-fraud columns to users (migration for existing DB)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'registration_ip') THEN
        ALTER TABLE users ADD COLUMN registration_ip VARCHAR(45);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_suspicious') THEN
        ALTER TABLE users ADD COLUMN is_suspicious BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

-- Migration: Add InsuranceFee to transactions type constraint (for existing DBs)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'chk_transactions_type_valid'
    ) THEN
        ALTER TABLE transactions DROP CONSTRAINT IF EXISTS chk_transactions_type_valid;
        ALTER TABLE transactions ADD CONSTRAINT chk_transactions_type_valid
            CHECK (type IN ('Deposit', 'Withdrawal', 'Investment', 'Profit', 'ReferralBonus', 'ManualAdjustment', 'Cashback', 'InsuranceFee'));
    END IF;
END $$;

-- Index for insurance fund queries
CREATE INDEX IF NOT EXISTS idx_transactions_insurance ON transactions (type) WHERE type = 'InsuranceFee';

-- Index for daily withdrawal limit queries
CREATE INDEX IF NOT EXISTS idx_transactions_withdrawal_daily ON transactions (type, status, created_at)
    WHERE type = 'Withdrawal' AND status IN ('Completed', 'Pending');
