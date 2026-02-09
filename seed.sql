-- ============================================================
-- TRADYX SEED DATA: Realistic Mock Ecosystem
-- ============================================================
-- 50 users in 3-level referral tree:
--   5 Leaders (Gold/Platinum)  → L0
--  15 Active Investors (Silver) → L1
--  30 Newcomers (Bronze)        → L2
--
-- ~52 investments (varied remaining_payouts)
-- ~2000+ transactions over 14 days
-- ~1000+ referral bonus logs
-- ~400 notifications
--
-- Password for ALL users: SeedPass123!
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Clean slate
TRUNCATE user_rank_history, referral_transactions, notifications,
         transactions, investments, users CASCADE;

-- ============================================================
-- MAIN SEED PROCEDURE
-- ============================================================
DO $$
DECLARE
    -- BCrypt hash for "SeedPass123!"
    pwd TEXT;
    now_ts TIMESTAMP;

    -- 50 user UUIDs (1-indexed)
    u UUID[];

    -- ── User metadata arrays (index 1..50) ──────────────────
    unames TEXT[] := ARRAY[
        -- L0: Leaders (1-5)
        'crypto_king', 'whale_master', 'dragon_inv', 'alpha_trades', 'moon_capital',
        -- L1: Active Investors (6-20)
        'silver_fox', 'steady_gains', 'profit_hunter',
        'bull_rider', 'diamond_hands', 'trade_ninja',
        'smart_money', 'yield_seeker', 'dca_master',
        'growth_capital', 'risk_taker', 'safe_harbor',
        'hodl_king', 'swing_trader', 'early_bird',
        -- L2: Newcomers (21-50)
        'newbie_alex', 'fresh_start',
        'beginner_01', 'crypto_curious',
        'first_timer', 'learning_curve',
        'small_steps', 'careful_carl',
        'penny_wise', 'slow_steady',
        'eager_emma', 'starter_pack',
        'step_by_step', 'budget_bob',
        'micro_invest', 'test_waters',
        'cautious_cat', 'tiny_trader',
        'save_first', 'pocket_money',
        'dabble_dan', 'try_hard',
        'safe_sally', 'low_risk',
        'watch_learn', 'observe_only',
        'copy_trader', 'follow_lead',
        'morning_dew', 'sunrise_inv'
    ];

    -- Referrer index (0 = no referrer)
    ref_map INT[] := ARRAY[
        0, 0, 0, 0, 0,
        1, 1, 1,    2, 2, 2,    3, 3, 3,    4, 4, 4,    5, 5, 5,
        6, 6,  7, 7,  8, 8,  9, 9,  10, 10,
        11, 11,  12, 12,  13, 13,  14, 14,  15, 15,
        16, 16,  17, 17,  18, 18,  19, 19,  20, 20
    ];

    -- 0=Bronze, 1=Silver, 2=Gold, 3=Platinum
    user_ranks INT[] := ARRAY[
        3, 3, 2, 2, 2,
        1, 1, 1, 1, 1,  1, 1, 1, 1, 1,  1, 1, 1, 1, 1,
        0, 0, 0, 0, 0,  0, 0, 0, 0, 0,
        0, 0, 0, 0, 0,  0, 0, 0, 0, 0,
        0, 0, 0, 0, 0,  0, 0, 0, 0, 0
    ];

    -- Days ago the user registered (decimal for fractional days)
    -- Leaders registered 25-30 days ago (so their investments pass the 21-day lock)
    -- Active investors 10-14 days ago (investments still locked)
    -- Newcomers 0-5 days ago
    created_ago NUMERIC[] := ARRAY[
        30, 28, 27, 25, 25,
        14, 13, 13, 12, 12,  11, 11, 10, 10, 10,  9, 9, 8, 8, 7,
        5, 4.5, 4, 3.5, 3,  2.5, 2, 2, 1.5, 1.5,
        1, 1, 2, 1, 0.5,  1, 1.5, 0.5, 2, 1,
        1.5, 0.5, 0.5, 1, 0.5,  0.3, 2, 0.5, 0.3, 1
    ];

    -- Initial deposit amount ($0 = registered but didn't deposit)
    deposits NUMERIC[] := ARRAY[
        7000, 6500, 3500, 3000, 2700,
        1000, 1500, 800, 1800, 1100,  900, 1400, 1000, 650, 1200,
        850, 700, 950, 1600, 650,
        100, 0, 150, 25, 0,  10, 60, 0, 50, 15,
        0, 5, 80, 0, 0,  20, 50, 0, 80, 10,
        70, 0, 0, 30, 50,  0, 120, 5, 0, 15
    ];

    -- Helpers
    rpath TEXT;
    ref_uuid UUID;
    i INT;
    p INT;
    inv_rec RECORD;
    inv_id UUID;
    payouts_done INT;
    profit NUMERIC;
    payout_time TIMESTAMP;
    payout_gap INTERVAL;
    inv_created TIMESTAMP;
    l1 INT; l2 INT; l3 INT;
    bonus NUMERIC;

BEGIN
    pwd := crypt('SeedPass123!', gen_salt('bf', 11));
    now_ts := NOW();

    -- ── Generate 50 UUIDs ───────────────────────────────────
    u := ARRAY[]::UUID[];
    FOR i IN 1..50 LOOP
        u := array_append(u, gen_random_uuid());
    END LOOP;

    -- ========================================================
    -- 1. INSERT USERS
    -- ========================================================
    FOR i IN 1..50 LOOP
        -- Compute referral_path
        IF ref_map[i] = 0 THEN
            rpath := NULL;
            ref_uuid := NULL;
        ELSE
            ref_uuid := u[ref_map[i]];
            IF ref_map[ref_map[i]] = 0 THEN
                rpath := ref_uuid::TEXT;                     -- L1
            ELSE
                rpath := u[ref_map[ref_map[i]]]::TEXT        -- L2
                      || '/' || ref_uuid::TEXT;
            END IF;
        END IF;

        INSERT INTO users (
            id, username, email, password_hash, balance,
            referrer_id, invite_code, referral_path,
            status, personal_turnover, team_turnover,
            registration_ip, is_suspicious, created_at
        ) VALUES (
            u[i],
            unames[i],
            unames[i] || '@tradyx.com',
            pwd,
            0,
            ref_uuid,
            UPPER(SUBSTR(unames[i], 1, 4)) || LPAD(i::TEXT, 4, '0'),
            rpath,
            user_ranks[i],
            0, 0,
            (100 + (i * 3) % 155)::TEXT || '.'
                || ((i * 7 + 13) % 256)::TEXT || '.'
                || ((i * 11 + 5) % 256)::TEXT || '.'
                || ((i * 17 + 37) % 256)::TEXT,
            false,
            now_ts - created_ago[i] * INTERVAL '1 day'
        );

        -- Welcome notification
        INSERT INTO notifications (id, user_id, message, is_read, created_at)
        VALUES (gen_random_uuid(), u[i],
                '🎉 Welcome to Tradyx! Start investing to earn daily profits.',
                true,
                now_ts - created_ago[i] * INTERVAL '1 day' + INTERVAL '1 minute');
    END LOOP;

    -- ========================================================
    -- 2. DEPOSIT TRANSACTIONS
    -- ========================================================
    FOR i IN 1..50 LOOP
        IF deposits[i] > 0 THEN
            INSERT INTO transactions (id, user_id, amount, type, description, status, created_at)
            VALUES (
                gen_random_uuid(), u[i], deposits[i], 'Deposit',
                'Account deposit via TRC-20: $' || TRIM(TO_CHAR(deposits[i], '999999.00')),
                'Completed',
                now_ts - created_ago[i] * INTERVAL '1 day' + INTERVAL '5 minutes'
            );

            INSERT INTO notifications (id, user_id, message, is_read, created_at)
            VALUES (gen_random_uuid(), u[i],
                    '💰 Your deposit of $' || TRIM(TO_CHAR(deposits[i], '999999.00'))
                        || ' has been credited.',
                    true,
                    now_ts - created_ago[i] * INTERVAL '1 day' + INTERVAL '6 minutes');
        END IF;
    END LOOP;

    -- ========================================================
    -- 3. INVESTMENTS + PROFIT HISTORY + REFERRAL BONUSES
    -- ========================================================
    CREATE TEMP TABLE _inv (
        user_idx    INT,
        amount      NUMERIC,
        rate        NUMERIC,
        started_ago NUMERIC,   -- days ago
        remaining   INT,
        active      BOOLEAN
    );

    -- NEW SUSTAINABLE RATES:
    -- Starter ($20-99):   0.50% daily, 45 days
    -- Growth  ($100-499): 0.65% daily, 60 days
    -- Premium ($500-1999):0.75% daily, 90 days
    -- Elite   ($2000+):   0.85% daily, 120 days

    INSERT INTO _inv VALUES
    -- ── Leaders (registered 25-30 days ago) ─────────────────
    -- Some investments >21 days ago (can early exit), some recent (still locked)
    -- Elite plan: 0.0085 rate, 120 days duration
    (1, 2000, 0.0085, 28,  92, true),    -- crypto_king: 28d ago, 28 payouts done, can early exit ✅
    (1, 3000, 0.0085, 25,  95, true),    --   25d ago, can early exit ✅
    (1, 2500, 0.0085,  4, 116, true),    --   recent, locked 🔒
    (2, 2000, 0.0085, 26,  94, true),    -- whale_master: 26d ago, can early exit ✅
    (2, 2500, 0.0085, 23,  97, true),    --   23d ago, can early exit ✅
    (2, 3000, 0.0085,  3, 117, true),    --   recent, locked 🔒
    -- Premium plan: 0.0075 rate, 90 days duration
    (3, 1500, 0.0075, 25,  65, true),    -- dragon_inv: 25d ago, can early exit ✅
    (3, 1000, 0.0075, 22,  68, true),    --   22d ago, can early exit ✅
    (4,  800, 0.0075, 24,  66, true),    -- alpha_trades: 24d, can exit ✅
    (4, 1500, 0.0075,  4,  86, true),    --   recent, locked 🔒
    (5,  700, 0.0075, 23,  67, true),    -- moon_capital: 23d, can exit ✅
    (5, 1200, 0.0075,  5,  85, true),    --   recent, locked 🔒

    -- ── Active Investors ────────────────────────────────────
    -- Premium plan ($500-1999): 0.0075, 90 days
    (6,  500, 0.0075,  8, 82, true),  (6,  300, 0.0065,  3, 57, true),
    (7,  700, 0.0075,  7, 83, true),  (7,  500, 0.0075,  3, 87, true),
    (8,  350, 0.0065,  6, 54, true),  (8,  250, 0.0065,  2, 58, true),
    (9, 1000, 0.0075,  9, 81, true),  (9,  500, 0.0075,  3, 87, true),
    (10, 500, 0.0075,  5, 85, true),  (10, 400, 0.0065,  3, 57, true),
    -- Growth plan ($100-499): 0.0065, 60 days
    (11, 400, 0.0065,  7, 53, true),  (11, 300, 0.0065,  3, 57, true),
    (12, 700, 0.0075,  8, 82, true),  (12, 400, 0.0065,  3, 57, true),
    (13, 500, 0.0075,  6, 84, true),  (13, 300, 0.0065,  3, 57, true),
    (14, 300, 0.0065,  4, 56, true),  (14, 200, 0.0065,  1, 59, true),
    (15, 600, 0.0075,  7, 83, true),  (15, 400, 0.0065,  4, 56, true),
    (16, 350, 0.0065,  6, 54, true),  (16, 300, 0.0065,  3, 57, true),
    (17, 300, 0.0065,  4, 56, true),  (17, 250, 0.0065,  2, 58, true),
    (18, 500, 0.0075,  7, 83, true),  (18, 250, 0.0065,  3, 57, true),
    (19, 800, 0.0075,  9, 81, true),  (19, 500, 0.0075,  4, 86, true),
    (20, 300, 0.0065,  4, 56, true),  (20, 200, 0.0065,  1, 59, true),

    -- ── Newcomers with investments ──────────────────────────
    -- Starter plan ($20-99): 0.005, 45 days
    (21,  50, 0.005,  1, 44, true),   -- newbie_alex
    (23,  80, 0.005,  2, 43, true),   -- beginner_01
    (27,  30, 0.005,  1, 44, true),   -- small_steps
    (29,  20, 0.005, 0.5,44, true),   -- penny_wise
    (33,  50, 0.005,  2, 43, true),   -- step_by_step
    (37,  25, 0.005,  1, 44, true),   -- cautious_cat
    (39,  50, 0.005,  2, 43, true),   -- save_first
    (41,  40, 0.005,  1, 44, true),   -- dabble_dan
    (45,  20, 0.005, 0.5,44, true),   -- watch_learn
    (47,  75, 0.005,  2, 43, true);   -- copy_trader

    -- ── Process each investment ─────────────────────────────
    FOR inv_rec IN SELECT * FROM _inv LOOP
        inv_id      := gen_random_uuid();
        payouts_done := 30 - inv_rec.remaining;
        inv_created  := now_ts - inv_rec.started_ago * INTERVAL '1 day';

        -- Investment record
        INSERT INTO investments (
            id, user_id, amount, daily_rate, created_at,
            next_payout_at, is_active, remaining_payouts
        ) VALUES (
            inv_id, u[inv_rec.user_idx], inv_rec.amount, inv_rec.rate,
            inv_created,
            CASE WHEN inv_rec.active
                 THEN now_ts + INTERVAL '2 minutes'
                 ELSE inv_created + INTERVAL '62 minutes'
            END,
            inv_rec.active, inv_rec.remaining
        );

        -- Investment purchase transaction
        INSERT INTO transactions (id, user_id, amount, type, description, status, created_at)
        VALUES (gen_random_uuid(), u[inv_rec.user_idx], inv_rec.amount,
                'Investment',
                'Investment plan: $' || TRIM(TO_CHAR(inv_rec.amount, '999999.00'))
                    || ' at ' || TRIM(TO_CHAR(inv_rec.rate * 100, '99.9')) || '% daily',
                'Completed',
                inv_created + INTERVAL '10 minutes');

        -- Investment activation notification
        INSERT INTO notifications (id, user_id, message, is_read, created_at)
        VALUES (gen_random_uuid(), u[inv_rec.user_idx],
                '📈 Investment activated: $' || TRIM(TO_CHAR(inv_rec.amount, '999999.00'))
                    || ' at ' || TRIM(TO_CHAR(inv_rec.rate * 100, '99.9')) || '% daily.',
                true,
                inv_created + INTERVAL '11 minutes');

        -- ── Generate profit payouts ─────────────────────────
        IF payouts_done > 0 THEN
            payout_gap := (now_ts - inv_created) / payouts_done;

            FOR p IN 1..payouts_done LOOP
                payout_time := inv_created + payout_gap * p;
                profit      := ROUND(inv_rec.amount * inv_rec.rate, 2);

                -- Profit transaction
                INSERT INTO transactions (id, user_id, amount, type, description, status, created_at)
                VALUES (gen_random_uuid(), u[inv_rec.user_idx], profit, 'Profit',
                        'Daily profit (' || TRIM(TO_CHAR(inv_rec.rate * 100, '99.9'))
                            || '%) — ' || (inv_rec.remaining + payouts_done - p)::TEXT
                            || ' payouts left',
                        'Completed', payout_time);

                -- Profit notification (last 2 payouts only to avoid spam)
                IF p >= payouts_done - 1 THEN
                    INSERT INTO notifications (id, user_id, message, is_read, created_at)
                    VALUES (gen_random_uuid(), u[inv_rec.user_idx],
                            '💰 Daily profit: +$' || TRIM(TO_CHAR(profit, '999999.00'))
                                || ' from your $' || TRIM(TO_CHAR(inv_rec.amount, '999999.00'))
                                || ' investment.',
                            CASE WHEN p < payouts_done THEN true ELSE false END,
                            payout_time + INTERVAL '1 second');
                END IF;

                -- ── Referral bonuses (3 levels) ─────────────
                l1 := ref_map[inv_rec.user_idx];
                IF l1 > 0 THEN
                    -- Level 1: 10%
                    bonus := ROUND(profit * 0.10, 2);
                    IF bonus > 0 THEN
                        INSERT INTO transactions VALUES (
                            gen_random_uuid(), u[l1], bonus, 'ReferralBonus',
                            'L1 referral bonus from ' || unames[inv_rec.user_idx],
                            'Completed', 0, false, NULL,
                            payout_time + INTERVAL '2 seconds');

                        INSERT INTO referral_transactions VALUES (
                            gen_random_uuid(), u[l1], u[inv_rec.user_idx],
                            1, bonus, 0.10, profit,
                            payout_time + INTERVAL '2 seconds');

                        -- Notification (first + last payout only)
                        IF p = 1 OR p = payouts_done THEN
                            INSERT INTO notifications VALUES (
                                gen_random_uuid(), u[l1],
                                '🎯 Referral bonus +$' || TRIM(TO_CHAR(bonus, '999999.00'))
                                    || ' (Level 1) from ' || unames[inv_rec.user_idx],
                                CASE WHEN p = 1 THEN true ELSE false END,
                                payout_time + INTERVAL '3 seconds');
                        END IF;
                    END IF;

                    l2 := ref_map[l1];
                    IF l2 > 0 THEN
                        -- Level 2: 5%
                        bonus := ROUND(profit * 0.05, 2);
                        IF bonus > 0 THEN
                            INSERT INTO transactions VALUES (
                                gen_random_uuid(), u[l2], bonus, 'ReferralBonus',
                                'L2 referral bonus from ' || unames[inv_rec.user_idx],
                                'Completed', 0, false, NULL,
                                payout_time + INTERVAL '3 seconds');

                            INSERT INTO referral_transactions VALUES (
                                gen_random_uuid(), u[l2], u[inv_rec.user_idx],
                                2, bonus, 0.05, profit,
                                payout_time + INTERVAL '3 seconds');

                            IF p = 1 OR p = payouts_done THEN
                                INSERT INTO notifications VALUES (
                                    gen_random_uuid(), u[l2],
                                    '🎯 Referral bonus +$' || TRIM(TO_CHAR(bonus, '999999.00'))
                                        || ' (Level 2) from ' || unames[inv_rec.user_idx],
                                    true,
                                    payout_time + INTERVAL '4 seconds');
                            END IF;
                        END IF;

                        l3 := ref_map[l2];
                        IF l3 > 0 THEN
                            -- Level 3: 2%
                            bonus := ROUND(profit * 0.02, 2);
                            IF bonus > 0 THEN
                                INSERT INTO transactions VALUES (
                                    gen_random_uuid(), u[l3], bonus, 'ReferralBonus',
                                    'L3 referral bonus from ' || unames[inv_rec.user_idx],
                                    'Completed', 0, false, NULL,
                                    payout_time + INTERVAL '4 seconds');

                                INSERT INTO referral_transactions VALUES (
                                    gen_random_uuid(), u[l3], u[inv_rec.user_idx],
                                    3, bonus, 0.02, profit,
                                    payout_time + INTERVAL '4 seconds');
                            END IF;
                        END IF;
                    END IF;
                END IF;

            END LOOP;  -- payouts
        END IF;

        -- Contract completed notification
        IF NOT inv_rec.active THEN
            INSERT INTO notifications VALUES (
                gen_random_uuid(), u[inv_rec.user_idx],
                '📄 Your investment contract of $' || TRIM(TO_CHAR(inv_rec.amount, '999999.00'))
                    || ' is completed! All 30 payouts received.',
                true,
                now_ts - INTERVAL '2 days');
        ELSIF inv_rec.remaining <= 5 THEN
            INSERT INTO notifications VALUES (
                gen_random_uuid(), u[inv_rec.user_idx],
                '⚠️ Your $' || TRIM(TO_CHAR(inv_rec.amount, '999999.00'))
                    || ' investment has only ' || inv_rec.remaining
                    || ' payouts remaining.',
                false,
                now_ts - INTERVAL '3 hours');
        END IF;

    END LOOP;  -- investments

    DROP TABLE _inv;

    -- ========================================================
    -- 4. RANK UPGRADE HISTORY
    -- ========================================================

    -- Leaders: full upgrade chain
    INSERT INTO user_rank_history (id, user_id, old_rank, new_rank,
                                   personal_turnover, team_turnover, created_at) VALUES
    -- crypto_king → Silver → Gold → Platinum
    (gen_random_uuid(), u[1], 0, 1, 2000,     0, now_ts - INTERVAL '12 days'),
    (gen_random_uuid(), u[1], 1, 2, 4000,  5000, now_ts - INTERVAL '8 days'),
    (gen_random_uuid(), u[1], 2, 3, 6000, 12000, now_ts - INTERVAL '4 days'),
    -- whale_master → Silver → Gold → Platinum
    (gen_random_uuid(), u[2], 0, 1, 2000,     0, now_ts - INTERVAL '12 days'),
    (gen_random_uuid(), u[2], 1, 2, 3500,  6000, now_ts - INTERVAL '7 days'),
    (gen_random_uuid(), u[2], 2, 3, 5500, 15000, now_ts - INTERVAL '3 days'),
    -- dragon_inv → Silver → Gold
    (gen_random_uuid(), u[3], 0, 1, 1500,     0, now_ts - INTERVAL '11 days'),
    (gen_random_uuid(), u[3], 1, 2, 3000,  8000, now_ts - INTERVAL '6 days'),
    -- alpha_trades → Silver → Gold
    (gen_random_uuid(), u[4], 0, 1, 1000,     0, now_ts - INTERVAL '10 days'),
    (gen_random_uuid(), u[4], 1, 2, 2500,  7000, now_ts - INTERVAL '5 days'),
    -- moon_capital → Silver → Gold
    (gen_random_uuid(), u[5], 0, 1, 1000,     0, now_ts - INTERVAL '9 days'),
    (gen_random_uuid(), u[5], 1, 2, 2200,  6500, now_ts - INTERVAL '4 days');

    -- Active investors: Bronze → Silver
    FOR i IN 6..20 LOOP
        INSERT INTO user_rank_history (id, user_id, old_rank, new_rank,
                                       personal_turnover, team_turnover, created_at)
        VALUES (gen_random_uuid(), u[i], 0, 1, 500, 0,
                now_ts - (created_ago[i] - 2) * INTERVAL '1 day');

        INSERT INTO notifications VALUES (
            gen_random_uuid(), u[i],
            '🏆 Congratulations! Your rank has been upgraded to Silver! '
                || 'Enjoy higher referral bonuses.',
            true,
            now_ts - (created_ago[i] - 2) * INTERVAL '1 day' + INTERVAL '1 second');
    END LOOP;

    -- Leader rank-up notifications
    FOR i IN 1..5 LOOP
        INSERT INTO notifications VALUES (
            gen_random_uuid(), u[i],
            '🏆 Your rank has been upgraded to '
                || CASE user_ranks[i]
                       WHEN 3 THEN 'Platinum'
                       WHEN 2 THEN 'Gold'
                       ELSE 'Silver' END
                || '! Maximum bonuses unlocked.',
            true,
            now_ts - INTERVAL '4 days');
    END LOOP;

    -- ========================================================
    -- 5. REFERRAL REGISTRATION NOTIFICATIONS
    -- ========================================================
    -- L1 users registering → notify their sponsor (leader)
    FOR i IN 6..20 LOOP
        INSERT INTO notifications VALUES (
            gen_random_uuid(), u[ref_map[i]],
            '👤 New referral joined: ' || unames[i]
                || ' registered using your invite code.',
            true,
            now_ts - created_ago[i] * INTERVAL '1 day' + INTERVAL '2 minutes');
    END LOOP;

    -- L2 users registering → notify their sponsor (active investor)
    FOR i IN 21..50 LOOP
        INSERT INTO notifications VALUES (
            gen_random_uuid(), u[ref_map[i]],
            '👤 New referral joined: ' || unames[i]
                || ' registered using your invite code.',
            CASE WHEN i <= 35 THEN true ELSE false END,
            now_ts - created_ago[i] * INTERVAL '1 day' + INTERVAL '2 minutes');
    END LOOP;

    -- ========================================================
    -- 6. WITHDRAWAL TRANSACTIONS (variety)
    -- ========================================================
    -- crypto_king: completed instant withdrawal, 5 days ago
    INSERT INTO transactions (id, user_id, amount, type, description,
                              status, fee_amount, is_instant, wallet_address, created_at)
    VALUES (gen_random_uuid(), u[1], -200, 'Withdrawal',
            'Instant withdrawal to wallet',
            'Completed', 14, true, 'TQYs...x3Rk7', now_ts - INTERVAL '5 days');
    INSERT INTO notifications VALUES (
        gen_random_uuid(), u[1],
        '💸 Your instant withdrawal of $200.00 has been processed! Fee: $14.00',
        true, now_ts - INTERVAL '5 days' + INTERVAL '30 seconds');

    -- whale_master: completed regular withdrawal, 4 days ago
    INSERT INTO transactions (id, user_id, amount, type, description,
                              status, fee_amount, is_instant, wallet_address, created_at)
    VALUES (gen_random_uuid(), u[2], -500, 'Withdrawal',
            'Regular withdrawal — approved',
            'Completed', 0, false, 'TJk2...p4Fm8', now_ts - INTERVAL '4 days');
    INSERT INTO notifications VALUES (
        gen_random_uuid(), u[2],
        '💸 Your withdrawal of $500.00 has been approved and sent!',
        true, now_ts - INTERVAL '3 days' + INTERVAL '2 hours');

    -- bull_rider: pending regular withdrawal, 1 day ago
    INSERT INTO transactions (id, user_id, amount, type, description,
                              status, fee_amount, is_instant, wallet_address, created_at)
    VALUES (gen_random_uuid(), u[9], -150, 'Withdrawal',
            'Regular withdrawal — pending admin approval',
            'Pending', 0, false, 'TMn8...qW2Lv', now_ts - INTERVAL '1 day');
    INSERT INTO notifications VALUES (
        gen_random_uuid(), u[9],
        '⏳ Your withdrawal request for $150.00 is pending admin review.',
        false, now_ts - INTERVAL '1 day' + INTERVAL '1 second');

    -- swing_trader: pending instant withdrawal, 6 hours ago
    INSERT INTO transactions (id, user_id, amount, type, description,
                              status, fee_amount, is_instant, wallet_address, created_at)
    VALUES (gen_random_uuid(), u[19], -100, 'Withdrawal',
            'Instant withdrawal — processing',
            'Pending', 7, true, 'TRe5...vK9Hd', now_ts - INTERVAL '6 hours');

    -- dragon_inv: completed instant, 2 days ago
    INSERT INTO transactions (id, user_id, amount, type, description,
                              status, fee_amount, is_instant, wallet_address, created_at)
    VALUES (gen_random_uuid(), u[3], -300, 'Withdrawal',
            'Instant withdrawal to wallet',
            'Completed', 21, true, 'TPq7...mB3Ys', now_ts - INTERVAL '2 days');
    INSERT INTO notifications VALUES (
        gen_random_uuid(), u[3],
        '💸 Your instant withdrawal of $300.00 has been processed! Fee: $21.00',
        true, now_ts - INTERVAL '2 days' + INTERVAL '15 seconds');

    -- ========================================================
    -- 7. COMPUTE FINAL BALANCES
    -- ========================================================
    -- balance = deposits + profits + referral_bonuses - investments + withdrawals
    -- (investments stored as positive amount with type 'Investment',
    --  withdrawals stored as negative amount)
    UPDATE users u SET balance = GREATEST(0, sub.computed)
    FROM (
        SELECT user_id,
            SUM(CASE
                WHEN type = 'Investment' THEN -amount
                ELSE amount
            END) AS computed
        FROM transactions
        WHERE status IN ('Completed', 'Pending')
        GROUP BY user_id
    ) sub
    WHERE u.id = sub.user_id;

    -- ========================================================
    -- 8. COMPUTE PERSONAL TURNOVER
    -- ========================================================
    UPDATE users u SET personal_turnover = sub.total
    FROM (
        SELECT user_id, COALESCE(SUM(amount), 0) AS total
        FROM investments GROUP BY user_id
    ) sub
    WHERE u.id = sub.user_id;

    -- ========================================================
    -- 9. COMPUTE TEAM TURNOVER (3-level recursive)
    -- ========================================================
    WITH RECURSIVE team AS (
        SELECT referrer_id AS root_id, id AS member_id, 1 AS lvl
        FROM users WHERE referrer_id IS NOT NULL
        UNION ALL
        SELECT t.root_id, u2.id, t.lvl + 1
        FROM users u2 JOIN team t ON u2.referrer_id = t.member_id
        WHERE t.lvl < 3
    )
    UPDATE users u SET team_turnover = sub.total
    FROM (
        SELECT t.root_id, COALESCE(SUM(m.personal_turnover), 0) AS total
        FROM team t JOIN users m ON m.id = t.member_id
        GROUP BY t.root_id
    ) sub
    WHERE u.id = sub.root_id;

    -- ========================================================
    -- 10. FILL-UP NOTIFICATIONS (min 5 per user)
    -- ========================================================
    FOR i IN 1..50 LOOP
        -- System announcement
        INSERT INTO notifications VALUES (
            gen_random_uuid(), u[i],
            '📢 New investment plans available! Check out our latest offerings with up to 1.7% daily return.',
            true,
            now_ts - INTERVAL '6 days');

        -- Security tip
        INSERT INTO notifications VALUES (
            gen_random_uuid(), u[i],
            '🔒 Security tip: Never share your password or wallet keys with anyone.',
            CASE WHEN i <= 20 THEN true ELSE false END,
            now_ts - INTERVAL '4 days');

        -- Referral promo
        INSERT INTO notifications VALUES (
            gen_random_uuid(), u[i],
            '💎 Invite friends and earn up to 10% bonus from their profits! Share your invite code now.',
            false,
            now_ts - INTERVAL '2 days');

        -- Market update
        INSERT INTO notifications VALUES (
            gen_random_uuid(), u[i],
            '📊 Weekly update: Platform trading volume exceeded $1.2M this week. Thank you for being part of Tradyx!',
            false,
            now_ts - INTERVAL '1 day');

        -- Maintenance
        INSERT INTO notifications VALUES (
            gen_random_uuid(), u[i],
            '🔧 Scheduled maintenance completed successfully. All systems operational.',
            true,
            now_ts - INTERVAL '8 days');
    END LOOP;

    -- ========================================================
    -- 11. ADMIN USER (superadmin@tradyx.com)
    -- ========================================================
    INSERT INTO users (
        id, username, email, password_hash, balance,
        invite_code, status, personal_turnover, team_turnover,
        registration_ip, is_suspicious, created_at
    ) VALUES (
        gen_random_uuid(), 'superadmin', 'superadmin@tradyx.com', pwd,
        99999.99, 'ADMN0000', 3, 0, 0, '127.0.0.1', false,
        now_ts - INTERVAL '30 days'
    );

    INSERT INTO notifications VALUES (
        gen_random_uuid(),
        (SELECT id FROM users WHERE username = 'superadmin'),
        '🔐 Admin account initialized. Full platform access granted.',
        true,
        now_ts - INTERVAL '30 days');

    RAISE NOTICE '';
    RAISE NOTICE '════════════════════════════════════════════════════════';
    RAISE NOTICE '  ✅  SEED DATA GENERATED SUCCESSFULLY';
    RAISE NOTICE '════════════════════════════════════════════════════════';
    RAISE NOTICE '  Users:     51 (1 Admin + 5 Leaders + 15 Active + 30 Newcomers)';
    RAISE NOTICE '  Password:  SeedPass123!';
    RAISE NOTICE '  Admin:     superadmin@tradyx.com';
    RAISE NOTICE '  Referral tree: 3 levels deep';
    RAISE NOTICE '';
    RAISE NOTICE '  📋 REFERRAL QUALIFICATION TEST CASES:';
    RAISE NOTICE '    ✅ Leaders (1-5): 3 active referrals each → CAN withdraw';
    RAISE NOTICE '    ❌ Active (6-20): 0-2 active referrals   → CANNOT withdraw';
    RAISE NOTICE '    ❌ Newbies (21-50): 0 referrals           → CANNOT withdraw';
    RAISE NOTICE '';
    RAISE NOTICE '  📋 EARLY EXIT TEST CASES:';
    RAISE NOTICE '    ✅ Leaders (1-5): registered 25-30 days ago → CAN early exit';
    RAISE NOTICE '    🔒 Active (6-20): registered 7-14 days ago → LOCKED (wait)';
    RAISE NOTICE '════════════════════════════════════════════════════════';

END $$;


-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

SELECT '─── Entity Counts ───' AS info;
SELECT 'Users' AS entity, COUNT(*) AS total FROM users
UNION ALL SELECT 'Investments', COUNT(*) FROM investments
UNION ALL SELECT 'Transactions', COUNT(*) FROM transactions
UNION ALL SELECT 'Referral Logs', COUNT(*) FROM referral_transactions
UNION ALL SELECT 'Notifications', COUNT(*) FROM notifications
UNION ALL SELECT 'Rank History', COUNT(*) FROM user_rank_history
ORDER BY entity;

SELECT '─── Top 10 Users by Balance ───' AS info;
SELECT username,
       '$' || TRIM(TO_CHAR(balance, '999,999.00')) AS balance,
       '$' || TRIM(TO_CHAR(personal_turnover, '999,999.00')) AS personal,
       '$' || TRIM(TO_CHAR(team_turnover, '999,999.00')) AS team,
       CASE status
           WHEN 0 THEN '🥉 Bronze'
           WHEN 1 THEN '🥈 Silver'
           WHEN 2 THEN '🥇 Gold'
           WHEN 3 THEN '💎 Platinum'
       END AS rank,
       (SELECT COUNT(*) FROM users r WHERE r.referrer_id = u.id) AS direct_refs
FROM users u
ORDER BY balance DESC
LIMIT 10;

SELECT '─── Investment Summary ───' AS info;
SELECT
    CASE WHEN is_active THEN 'Active' ELSE 'Completed' END AS status,
    COUNT(*) AS count,
    '$' || TRIM(TO_CHAR(SUM(amount), '999,999.00')) AS total_amount,
    ROUND(AVG(remaining_payouts), 1) AS avg_remaining
FROM investments
GROUP BY is_active
ORDER BY is_active DESC;

SELECT '─── Transaction Breakdown ───' AS info;
SELECT type,
       COUNT(*) AS count,
       '$' || TRIM(TO_CHAR(SUM(ABS(amount)), '999,999.00')) AS total_volume
FROM transactions
GROUP BY type
ORDER BY COUNT(*) DESC;

SELECT '─── Referral Bonus by Level ───' AS info;
SELECT 'Level ' || level AS ref_level,
       COUNT(*) AS entries,
       '$' || TRIM(TO_CHAR(SUM(amount), '999,999.00')) AS total_paid
FROM referral_transactions
GROUP BY level
ORDER BY level;

SELECT '─── Pending Withdrawals ───' AS info;
SELECT u.username,
       '$' || TRIM(TO_CHAR(ABS(t.amount), '999,999.00')) AS amount,
       '$' || TRIM(TO_CHAR(t.fee_amount, '999,999.00')) AS fee,
       CASE WHEN t.is_instant THEN 'Instant' ELSE 'Regular' END AS type,
       t.created_at
FROM transactions t
JOIN users u ON u.id = t.user_id
WHERE t.type = 'Withdrawal' AND t.status = 'Pending'
ORDER BY t.created_at;

SELECT '─── Referral Qualification for Withdrawal ───' AS info;
SELECT
    u.username,
    (SELECT COUNT(*) FROM users r
     WHERE r.referrer_id = u.id
       AND r.id IN (SELECT DISTINCT user_id FROM investments WHERE is_active = true)
    ) AS active_refs,
    CASE WHEN (SELECT COUNT(*) FROM users r
               WHERE r.referrer_id = u.id
                 AND r.id IN (SELECT DISTINCT user_id FROM investments WHERE is_active = true)) >= 3
         THEN '✅ Can Withdraw' ELSE '🔒 Locked' END AS withdrawal_status,
    CASE WHEN NOW() - u.created_at > INTERVAL '21 days'
         THEN '✅ Can Early Exit' ELSE '🔒 Locked (' || CEIL(EXTRACT(EPOCH FROM (u.created_at + INTERVAL '21 days' - NOW())) / 86400) || 'd left)' END AS early_exit_status
FROM users u
WHERE u.email != 'superadmin@tradyx.com'
ORDER BY u.created_at ASC
LIMIT 20;

SELECT '─── Balance Consistency Check ───' AS info;
SELECT
    u.username,
    u.balance AS stored_balance,
    COALESCE(sub.computed, 0) AS computed_balance,
    CASE WHEN ABS(u.balance - COALESCE(sub.computed, 0)) < 0.01
         THEN '✅ OK' ELSE '❌ MISMATCH' END AS status
FROM users u
LEFT JOIN (
    SELECT user_id,
        GREATEST(0, SUM(CASE WHEN type = 'Investment' THEN -amount ELSE amount END)) AS computed
    FROM transactions
    WHERE status IN ('Completed', 'Pending')
    GROUP BY user_id
) sub ON sub.user_id = u.id
WHERE ABS(u.balance - COALESCE(sub.computed, 0)) >= 0.01
ORDER BY u.username;
