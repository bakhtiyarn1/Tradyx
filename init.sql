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
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);
CREATE INDEX IF NOT EXISTS idx_users_referrer ON users (referrer_id);
CREATE INDEX IF NOT EXISTS idx_users_invite_code ON users (invite_code) WHERE invite_code != '';

COMMENT ON TABLE users IS 'Platform users';
COMMENT ON COLUMN users.balance IS 'Current account balance in USD';
COMMENT ON COLUMN users.referrer_id IS 'ID of the direct parent referrer';
COMMENT ON COLUMN users.invite_code IS 'Unique 8-char alphanumeric invite code';
COMMENT ON COLUMN users.referral_path IS 'Ancestor chain root→parent, e.g. grandpaId/parentId';
COMMENT ON COLUMN users.status IS '0=Bronze, 1=Silver, 2=Gold, 3=Platinum';
COMMENT ON COLUMN users.personal_turnover IS 'Cumulative personal investment amount';
COMMENT ON COLUMN users.team_turnover IS 'Cumulative team turnover across 3 referral levels';

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

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    amount DECIMAL(18,2) NOT NULL,
    type VARCHAR(50) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_transactions_type_valid CHECK (type IN ('Deposit', 'Withdrawal', 'Investment', 'Profit', 'ReferralBonus', 'ManualAdjustment', 'Cashback'))
);

CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions (type);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions (created_at DESC);

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

COMMENT ON TABLE user_rank_history IS 'Logs every rank promotion: Bronze→Silver→Gold→Platinum';

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

-- Backfill team_turnover (sum of L1-L3 referrals' personal_turnover)
WITH RECURSIVE team AS (
    SELECT referrer_id AS root_id, id AS member_id, 1 AS lvl FROM users WHERE referrer_id IS NOT NULL
    UNION ALL
    SELECT t.root_id, u.id, t.lvl + 1
    FROM users u JOIN team t ON u.referrer_id = t.member_id WHERE t.lvl < 3
)
UPDATE users u SET team_turnover = sub.total
FROM (
    SELECT t.root_id, COALESCE(SUM(m.personal_turnover), 0) AS total
    FROM team t JOIN users m ON m.id = t.member_id
    GROUP BY t.root_id
) sub
WHERE u.id = sub.root_id AND sub.total > 0 AND u.team_turnover = 0;
