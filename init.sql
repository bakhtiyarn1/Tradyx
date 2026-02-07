-- Tradyx Database Schema

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    balance DECIMAL(18,2) NOT NULL DEFAULT 0.00,
    referrer_id UUID REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);
CREATE INDEX IF NOT EXISTS idx_users_referrer ON users (referrer_id);

COMMENT ON TABLE users IS 'Platform users';
COMMENT ON COLUMN users.balance IS 'Current account balance in USD';
COMMENT ON COLUMN users.referrer_id IS 'ID of the user who referred this user';

-- Investments table
CREATE TABLE IF NOT EXISTS investments (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    amount DECIMAL(18,2) NOT NULL,
    daily_rate DECIMAL(8,4) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    next_payout_at TIMESTAMP NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_investments_user ON investments (user_id);
CREATE INDEX IF NOT EXISTS idx_investments_active ON investments (is_active, next_payout_at);

COMMENT ON TABLE investments IS 'User investment plans';
COMMENT ON COLUMN investments.daily_rate IS 'Daily interest rate as a decimal (e.g. 0.008 = 0.8%)';
COMMENT ON COLUMN investments.next_payout_at IS 'When the next payout is due';

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    amount DECIMAL(18,2) NOT NULL,
    type VARCHAR(50) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_transactions_type_valid CHECK (type IN ('Deposit', 'Withdrawal', 'Investment', 'Profit', 'ReferralBonus', 'ManualAdjustment'))
);

CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions (type);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions (created_at DESC);

COMMENT ON TABLE transactions IS 'Financial transaction history';
COMMENT ON COLUMN transactions.type IS 'Transaction type: Deposit, Withdrawal, Investment, Profit, ReferralBonus, ManualAdjustment';

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

COMMENT ON TABLE notifications IS 'User notification messages';
