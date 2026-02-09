# Tradyx Platform — Full Technical Report

**Version**: 2.0 (February 2026)  
**Stack**: .NET 9.0 + React 19 + PostgreSQL + SignalR + Telegram Bots (Node.js)

---

## 1. Architecture Overview

### 1.1 Backend (.NET 9.0 — Clean Architecture)

```
Tradyx.Api/          — ASP.NET Core Web API (Controllers, Hubs, Middleware)
Tradyx.Core/         — Domain Entities, Interfaces (DTOs, Abstractions)
Tradyx.Infrastructure/ — Services, Repositories, Background Workers
```

- **Database**: PostgreSQL 16 (Docker Compose, port 5433)
- **ORM**: Dapper (micro-ORM for raw SQL + performance)
- **Auth**: JWT Bearer tokens (1440 min expiry)
- **Real-time**: SignalR WebSocket hub (`/hubs/notifications`)
- **Background**: `PayoutWorker` (hosted service, runs every 60s)

### 1.2 Frontend (React 19 + TypeScript 5.9)

- **Build**: Vite 7.2
- **Routing**: React Router 7.13
- **State**: TanStack Query 5.90 + React Context
- **UI**: Tailwind CSS 4.1 + Framer Motion 12.31 + Recharts 3.7
- **Real-time**: `@microsoft/signalr` with auto-reconnect
- **Sound**: Web Audio API (`useSounds` hook)

### 1.3 Telegram Bots (Node.js)

- **User Bot** (`bot/index.js`): Telegraf, handles user auth, balance checks, investment actions
- **Admin Bot** (`bot/admin.js`): Admin notifications, user management, auto-ID registration
- **Communication**: HTTP notification endpoints (ports 3333/3334)

---

## 2. Database Schema

### Tables

| Table | Purpose | Key Columns |
|---|---|---|
| `users` | User accounts | `id` (UUID), `balance`, `status` (rank), `referrer_id`, `invite_code`, `referral_path`, `telegram_id`, `personal_turnover`, `team_turnover`, `registration_ip`, `is_suspicious` |
| `investments` | Active/completed investments | `user_id`, `amount`, `daily_rate`, `remaining_payouts`, `is_active`, `next_payout_at` |
| `investment_plans` | Admin-managed plans | `name`, `min_amount`, `max_amount`, `daily_rate`, `duration_days`, `is_active`, `color` |
| `transactions` | All financial operations | `user_id`, `amount`, `type`, `status`, `fee_amount`, `is_instant`, `wallet_address` |
| `notifications` | User notification feed | `user_id`, `message`, `is_read` |
| `referral_transactions` | Referral bonus log | `recipient_id`, `source_user_id`, `level`, `amount`, `rate` |
| `user_rank_history` | Rank upgrade log | `user_id`, `old_rank`, `new_rank` |

### Transaction Types

`Deposit`, `Withdrawal`, `Investment`, `Profit`, `ReferralBonus`, `ManualAdjustment`, `Cashback`, `InsuranceFee`

### Transaction Statuses

`Pending`, `Approved`, `Rejected`, `Completed`

---

## 3. Authentication & Security

### 3.1 Auth Flow

- **Regular users**: Telegram-only login (deeplink → bot confirms → JWT issued)
- **Admin**: Email/password login at `/admin-login`
- **JWT**: Stored in `localStorage`, injected via Axios interceptor + SignalR query string

### 3.2 Security Measures

- **Row-level locking** (`FOR UPDATE`, `FOR UPDATE SKIP LOCKED`) on all balance operations
- **Database transactions** (ACID) for all financial operations
- **Anti-fraud**: Registration IP tracking, `is_suspicious` flag when referrer IP matches
- **Rate limiting** (configurable)
- **CORS** configured for frontend origin
- **JWT secret** externalized to environment variables

---

## 4. Investment System

### 4.1 Plans (DB-Driven, Admin CRUD)

| Plan | Min-Max | Daily Rate | Duration | Total ROI |
|---|---|---|---|---|
| Starter | $20 — $99.99 | 0.50% | 45 days | 22.5% |
| Growth | $100 — $499.99 | 0.65% | 60 days | 39% |
| Premium | $500 — $1,999.99 | 0.75% | 90 days | 67.5% |
| Elite | $2,000+ | 0.85% | 120 days | 102% |

### 4.2 Dynamic Rate Adjustment (NEW)

Investment rates are automatically adjusted based on treasury health:

- **Green Zone** (health ratio > 50%): ×1.0 (normal rates)
- **Yellow Zone** (25-50%): ×0.80 (rates reduced by 20%)
- **Red Zone** (<25%): ×0.60 (rates reduced by 40%)

**Health Ratio** = System Reserve / Active Investments

This prevents the platform from over-committing when reserves are low.

### 4.3 Payout Mechanism

- `PayoutWorker` runs every 60 seconds
- Picks investments where `next_payout_at <= NOW()` and `remaining_payouts > 0`
- Uses `FOR UPDATE SKIP LOCKED` to prevent double payouts
- Decrements `remaining_payouts`; deactivates investment when it reaches 0
- Triggers referral bonuses + rank checks after each payout

### 4.4 Early Exit

- Allowed after **21-day** lock-in period (configurable)
- **15% early exit fee** deducted from investment body
- Investment deactivated, remaining body minus fee credited to balance

---

## 5. Referral System (3-Level)

### 5.1 Rates

| Level | Base Rate | Notes |
|---|---|---|
| Level 1 (direct) | 5% | Of referral's investment payout |
| Level 2 | 2% | Of L2 referral's payout |
| Level 3 | 1% | Of L3 referral's payout |

### 5.2 Rank-Based Multipliers

| Rank | L1 Mult | L2 Mult | L3 Mult | Cashback |
|---|---|---|---|---|
| Bronze | ×1.0 | ×1.0 | ×1.0 | 0% |
| Silver | ×1.0 | ×1.0 | ×1.0 | 0% |
| Gold | ×1.1 | ×1.2 | ×1.2 | 0.5% |
| Platinum | ×1.2 | ×1.3 | ×1.5 | 1% |

### 5.3 Referral Path

Stored as `id1/id2/id3` for O(1) ancestor lookup via string splitting (no recursive queries at payout time).

### 5.4 Mandatory Referral Qualification

Users must have **at least 3 active referrals** (referrals who have active investments) to withdraw funds.

---

## 6. Rank System (Gamification)

### 6.1 Ranks & Thresholds

| Rank | Personal Invest | Team Turnover |
|---|---|---|
| Bronze | Default | Default |
| Silver | $300 | $1,500 |
| Gold | $1,500 | $8,000 |
| Platinum | $5,000 | $40,000 |

### 6.2 Automatic Upgrades

- `IRankService.CheckAndUpgradeStatusAsync` called after every investment and payout
- Logs rank changes to `user_rank_history`
- Sends SignalR + Telegram notifications on upgrade

---

## 7. Treasury Management (NEW)

### 7.1 Insurance Fund

- **5% of every deposit** is allocated to the insurance fund
- Recorded as `InsuranceFee` transaction type
- Insurance fund balance visible in admin Treasury Health panel
- User receives full deposit amount (insurance is a platform-level reserve)

### 7.2 Treasury Health Monitoring

Admin endpoint `GET /api/admin/treasury` returns:

```json
{
  "totalDeposits": 39845.00,
  "totalPayouts": 9811.89,
  "reserve": 30033.11,
  "activeInvestments": 34990.00,
  "insuranceFund": 5.00,
  "healthRatio": 0.8583,
  "zone": "green",
  "rateMultiplier": 1.0,
  "withdrawnToday": 100.00,
  "dailyWithdrawalLimit": 3003.31,
  "estimatedRunwayDays": 3
}
```

### 7.3 Dynamic Rate Adjustment

- Rate multiplier applied at investment purchase time
- Based on real-time treasury health ratio
- Configurable thresholds in `appsettings.json`:

```json
"TreasurySettings": {
  "DynamicRates": {
    "GreenThreshold": 0.50,
    "YellowThreshold": 0.25,
    "YellowMultiplier": 0.80,
    "RedMultiplier": 0.60
  }
}
```

### 7.4 Estimated Runway

Calculated as `reserve / average_daily_payout` (7-day rolling average).

---

## 8. Withdrawal System

### 8.1 Types

| Type | Fee | Processing | Limit |
|---|---|---|---|
| Regular | 0% | 1-3 days (admin approval) | No per-tx limit |
| Instant | 7% (rank discounts apply) | Immediate | $500 max per transaction |

### 8.2 Rank Fee Discounts

- Gold: 15% discount on instant fee
- Platinum: 30% discount on instant fee

### 8.3 Daily Withdrawal Limits (NEW)

**Platform-wide limit**: 10% of system reserve per day (min $500)

**Personal limits by rank**:

| Rank | Daily Limit |
|---|---|
| Bronze | $200 |
| Silver | $500 |
| Gold | $1,000 |
| Platinum | $2,000 |

### 8.4 Cooling Period (NEW)

After each deposit, a cooling period is enforced before withdrawals are allowed:

| Deposit Size | Cooling Period |
|---|---|
| < $100 | 24 hours |
| $100 — $999 | 72 hours |
| $1,000+ | 168 hours (7 days) |

### 8.5 Additional Checks

- Only one pending withdrawal at a time per user
- Mandatory 3 active referrals (referral qualification)
- Balance frozen on pending regular withdrawals

---

## 9. Real-Time Communication

### 9.1 SignalR Hub (`/hubs/notifications`)

Events pushed to clients:
- `BalanceUpdated(decimal balance)`
- `InvestmentUpdated()`
- `PayoutReceived(decimal amount)`
- `TransactionCreated(string type, decimal amount)`
- `NewNotification(string message)`
- `StatusUpgraded(int newRank, string rankName)`

### 9.2 Telegram Notifications

Both bots receive all platform events:
- New user registrations
- Deposits (with insurance breakdown)
- Investments (with plan details)
- Payouts (daily profit)
- Withdrawals (with status)
- Rank upgrades
- Early exits

---

## 10. API Endpoints

### Auth (`/api/auth`)
| Method | Path | Description |
|---|---|---|
| POST | `/login` | Email/password login (admin) |
| POST | `/register` | Register new user |
| POST | `/telegram/init` | Start Telegram login flow |
| GET | `/telegram/check` | Poll for Telegram login confirmation |
| POST | `/telegram/confirm` | Bot confirms auth (internal) |

### User (`/api/user`)
| Method | Path | Description |
|---|---|---|
| GET | `/me` | Get profile |
| GET | `/me/dashboard` | Dashboard with rank progress |
| GET | `/me/transactions` | Transaction history |
| GET | `/me/notifications` | Notifications |
| PATCH | `/me/notifications/{id}/read` | Mark notification read |
| PATCH | `/me/notifications/read-all` | Mark all read |
| POST | `/me/deposit` | Deposit (with insurance deduction) |
| POST | `/me/withdraw` | Withdraw (with cooling + limits check) |
| GET | `/me/withdrawal-info` | Fee rates, limits |
| GET | `/me/withdrawal-limits` | Daily limits + cooling status |
| GET | `/me/referral-qualification` | Referral check (3/3) |
| GET | `/me/team` | 3-level referral team |

### Investment (`/api/investment`)
| Method | Path | Description |
|---|---|---|
| POST | `/purchase` | Buy investment (dynamic rate applied) |
| GET | `/my` | My investments |
| GET | `/plans` | Plans + rate multiplier |
| POST | `/{id}/early-exit` | Early exit (after 21d, 15% fee) |

### Admin (`/api/admin`)
| Method | Path | Description |
|---|---|---|
| GET | `/stats` | Global statistics |
| GET | `/treasury` | Treasury health + zones |
| GET | `/all-users` | All users list |
| GET | `/users/{id}/full-details` | User details |
| POST | `/users/{id}/adjust-balance` | Adjust user balance |
| POST | `/payouts/trigger` | Manual payout trigger |
| GET | `/withdrawals/pending` | Pending withdrawal queue |
| POST | `/withdrawals/{id}/approve` | Approve withdrawal |
| POST | `/withdrawals/{id}/reject` | Reject withdrawal |
| GET/POST/PUT/DELETE | `/plans/*` | CRUD investment plans |
| GET | `/analytics` | Detailed analytics (charts) |

---

## 11. Frontend Pages

| Route | Component | Description |
|---|---|---|
| `/login` | `TelegramLogin` | Telegram-only login for users |
| `/admin-login` | `AdminLogin` | Email/password admin login |
| `/dashboard` | `Dashboard` | Main user dashboard, rank, stats |
| `/investments` | `Investments` | Plans (with dynamic rate indicator), active investments, early exit |
| `/wallet` | `Wallet` | Deposit, withdraw (with cooling/limits/referral UI), transactions |
| `/referrals` | `Referrals` | 3-level team view, earnings |
| `/notifications` | `Notifications` | Notification feed |
| `/admin` | `AdminPanel` | Overview (treasury health), analytics, plans CRUD, users, withdrawals |

---

## 12. Configuration Reference (`appsettings.json`)

```json
{
  "ConnectionStrings": { "DefaultConnection": "Host=localhost;Port=5433;..." },
  "JwtSettings": { "Secret": "...", "Issuer": "TradyxApi", "ExpiryMinutes": 1440 },
  "ReferralSettings": { "Level1Rate": 0.05, "Level2Rate": 0.02, "Level3Rate": 0.01 },
  "RankSettings": {
    "Silver": { "PersonalInvest": 300, "TeamTurnover": 1500 },
    "Gold": { "PersonalInvest": 1500, "TeamTurnover": 8000 },
    "Platinum": { "PersonalInvest": 5000, "TeamTurnover": 40000 },
    "BonusMultipliers": {
      "Bronze": { "L1": 1.0, "L2": 1.0, "L3": 1.0, "Cashback": 0.0 },
      "Silver": { "L1": 1.0, "L2": 1.0, "L3": 1.0, "Cashback": 0.0 },
      "Gold": { "L1": 1.1, "L2": 1.2, "L3": 1.2, "Cashback": 0.005 },
      "Platinum": { "L1": 1.2, "L2": 1.3, "L3": 1.5, "Cashback": 0.01 }
    }
  },
  "InvestmentSettings": { "EarlyExitFee": 0.15, "MinLockDays": 21 },
  "ReferralQualification": { "MinActiveReferrals": 3 },
  "WithdrawalSettings": {
    "InstantFeeRate": 0.07,
    "InstantMaxAmount": 500,
    "MinAmount": 10,
    "FeeDiscounts": { "Bronze": 0, "Silver": 0, "Gold": 0.15, "Platinum": 0.30 }
  },
  "TreasurySettings": {
    "Insurance": { "Rate": 0.05 },
    "DynamicRates": {
      "GreenThreshold": 0.50,
      "YellowThreshold": 0.25,
      "YellowMultiplier": 0.80,
      "RedMultiplier": 0.60
    },
    "DailyLimits": {
      "PercentOfReserve": 0.10,
      "MinimumAmount": 500,
      "Personal": { "Bronze": 200, "Silver": 500, "Gold": 1000, "Platinum": 2000 }
    },
    "CoolingPeriod": {
      "SmallHours": 24,
      "MediumHours": 72,
      "LargeHours": 168,
      "MediumThreshold": 100,
      "LargeThreshold": 1000
    }
  }
}
```

---

## 13. Deployment (Local)

### Prerequisites
- Docker Desktop
- .NET 9.0 SDK
- Node.js 20+

### Start Everything

```bash
# 1. Database
docker compose up -d

# 2. Init schema + seed
docker exec -i tradyx-postgres psql -U postgres -d tradyx_db < init.sql
docker exec -i tradyx-postgres psql -U postgres -d tradyx_db < seed.sql

# 3. Backend
cd src/Tradyx.Api && dotnet run --urls "http://localhost:5001"

# 4. Frontend
cd frontend && npm install && npm run dev

# 5. Telegram Bots
cd bot && npm install
node index.js    # User bot (port 3333)
node admin.js    # Admin bot (port 3334)
```

### Credentials
- **Superadmin**: `superadmin@tradyx.com` / `SeedPass123!`
- **Users**: Telegram-only login

---

## 14. Economic Sustainability Analysis

### Revenue Streams (per $100 deposit)
1. **Insurance Fund**: $5 (5%)
2. **Early Exit Fees**: $15 (15%, if triggered)
3. **Instant Withdrawal Fees**: $7 (7%)
4. **Unclaimed Referral Bonuses**: ~$2-3 (L2/L3 when no ancestors exist)

### Cost Streams (per $100 investment)
1. **Profit Payouts**: $22.50 - $102 (plan-dependent)
2. **Referral Bonuses**: $1.20 - $6.80 (8% max, level-dependent)
3. **Cashback**: $0 - $1 (rank-dependent)

### Sustainability Mechanisms
1. **Dynamic rates**: Automatically reduce payouts when treasury is stressed
2. **Insurance fund**: 5% reserve from every deposit
3. **Daily withdrawal limits**: Prevent bank runs (10% of reserve/day)
4. **Cooling periods**: 24h-7d delay between deposit and withdrawal
5. **Investment expiration**: All plans have finite duration (45-120 days)
6. **Early exit penalty**: 15% fee discourages premature withdrawals
7. **Referral qualification**: 3 active referrals required to withdraw
8. **Rank-gated limits**: Higher ranks needed for larger daily withdrawals

### Health Monitoring
- Admin treasury dashboard with real-time health ratio
- Zone system (green/yellow/red) with automatic rate adjustment
- Estimated runway calculation (days of reserves remaining)
- Insurance fund tracking

---

## 15. File Structure

```
Tradyx/
├── docker-compose.yml
├── init.sql                    # Schema + migrations
├── seed.sql                    # Mock data
├── PLATFORM_REPORT.md          # This file
│
├── src/
│   ├── Tradyx.Api/
│   │   ├── Controllers/
│   │   │   ├── AuthController.cs
│   │   │   ├── UserController.cs
│   │   │   ├── InvestmentController.cs
│   │   │   └── AdminController.cs
│   │   ├── Hubs/
│   │   │   └── NotificationHub.cs
│   │   ├── Program.cs
│   │   └── appsettings.json
│   │
│   ├── Tradyx.Core/
│   │   ├── Entities/
│   │   │   ├── User.cs, Investment.cs, Transaction.cs, Notification.cs
│   │   │   └── InvestmentPlan.cs
│   │   ├── DTOs/
│   │   │   ├── LoginRequest.cs, LoginResponse.cs, DepositRequest.cs
│   │   │   ├── InvestmentRequest.cs, WithdrawalRequest.cs
│   │   │   ├── User/ (Dashboard, Profile DTOs)
│   │   │   └── Admin/ (Stats, Analytics, Plans DTOs)
│   │   └── Interfaces/
│   │       ├── IUserRepository.cs, IInvestmentRepository.cs
│   │       ├── IAuthService.cs, IInvestmentService.cs
│   │       ├── IWithdrawalService.cs, IRankService.cs
│   │       ├── IReferralService.cs, IPayoutService.cs
│   │       ├── ITreasuryService.cs           # NEW
│   │       ├── IRealtimeNotifier.cs
│   │       └── ITelegramNotifier.cs
│   │
│   └── Tradyx.Infrastructure/
│       ├── Services/
│       │   ├── AuthService.cs, InvestmentService.cs
│       │   ├── WithdrawalService.cs, RankService.cs
│       │   ├── ReferralService.cs, PayoutService.cs
│       │   ├── TreasuryService.cs            # NEW
│       │   └── TelegramNotifierService.cs
│       ├── Repositories/
│       │   ├── UserRepository.cs, InvestmentRepository.cs
│       │   ├── TransactionRepository.cs, NotificationRepository.cs
│       │   └── AdminRepository.cs
│       ├── BackgroundServices/
│       │   └── PayoutWorker.cs
│       └── DependencyInjection.cs
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx, Investments.tsx, Wallet.tsx
│   │   │   ├── Referrals.tsx, Notifications.tsx
│   │   │   ├── AdminPanel.tsx, AdminLogin.tsx
│   │   │   └── TelegramLogin.tsx
│   │   ├── components/
│   │   │   ├── Layout.tsx, ProtectedRoute.tsx, PublicRoute.tsx
│   │   │   └── SlotMachineCounter.tsx
│   │   ├── hooks/
│   │   │   └── useSounds.ts
│   │   ├── lib/
│   │   │   ├── api.ts, signalr.ts, auth.tsx, toast.tsx
│   │   │   └── sounds.ts
│   │   └── App.tsx
│   └── package.json
│
└── bot/
    ├── index.js              # User Telegram bot
    ├── admin.js              # Admin Telegram bot
    ├── .env                  # Bot tokens
    └── package.json
```

---

## 16. What's New in This Release

### Feature 1: Dynamic Investment Rates (Treasury Health)

**Problem**: Fixed rates can bankrupt the platform if deposits slow down.

**Solution**: `TreasuryService` calculates a health ratio (`reserve / active_investments`) and applies a rate multiplier:
- Green (>50%): ×1.0 — normal rates
- Yellow (25-50%): ×0.80 — 20% reduction
- Red (<25%): ×0.60 — 40% reduction

**Implementation**:
- `ITreasuryService.GetRateMultiplierAsync()` called during `InvestmentService.PurchaseAsync()`
- Frontend shows "Moderate Market Conditions" or "Conservative Mode Active" banner
- Plans display both original and adjusted rates when multiplier < 1.0
- Admin Treasury panel shows zone, health ratio, estimated runway

### Feature 2: Insurance Fund

**Problem**: No safety net when the platform faces liquidity stress.

**Solution**: 5% of every deposit is allocated to an insurance fund:
- Recorded as `InsuranceFee` transaction type
- User receives full deposit amount (insurance is platform-level)
- Visible in admin Treasury Health panel
- Grows automatically with every deposit

**Implementation**:
- `UserRepository.DepositWithInsuranceAsync()` handles the split
- `TreasuryService.ProcessDepositInsuranceAsync()` records the fee
- Frontend deposit confirmation shows insurance allocation

### Feature 3: Daily Withdrawal Limits + Cooling Period

**Problem**: Large or rapid withdrawals can destabilize the platform.

**Solution**:
1. **Platform daily limit**: 10% of system reserve (min $500)
2. **Personal daily limits**: Rank-based ($200 Bronze → $2000 Platinum)
3. **Cooling period**: 24h-168h delay after deposit before withdrawal

**Implementation**:
- `TreasuryService.CheckDailyWithdrawalLimitAsync()` — platform + personal
- `TreasuryService.CheckCoolingPeriodAsync()` — based on last deposit size
- Called before `WithdrawalService.RequestWithdrawalAsync()`
- Frontend shows cooling timer, daily limit progress bar, blocked button states
- `GET /api/user/me/withdrawal-limits` returns all limit info

---

*Report generated: February 2026*
