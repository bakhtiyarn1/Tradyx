using Dapper;
using Tradyx.Core.DTOs.Admin;
using Tradyx.Core.Entities;
using Tradyx.Core.Interfaces;

namespace Tradyx.Infrastructure.Repositories;

public class AdminRepository : IAdminRepository
{
    private readonly IDbConnectionFactory _connectionFactory;

    public AdminRepository(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<GlobalStatsResponse> GetGlobalStatsAsync(CancellationToken cancellationToken = default)
    {
        const string sql = @"
            SELECT 
                (SELECT COUNT(*) FROM users) AS total_users,
                (SELECT COALESCE(SUM(amount), 0) FROM investments WHERE is_active = true) AS total_invested,
                (SELECT COUNT(*) FROM investments WHERE is_active = true) AS active_investments_count,
                (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE type = 'Profit') AS total_profit_paid,
                (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE type = 'ReferralBonus') AS total_referral_paid,
                (SELECT COALESCE(ABS(SUM(amount)), 0) FROM transactions WHERE type = 'Investment') AS total_deposits,
                (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE type IN ('Profit', 'ReferralBonus')) AS total_payouts";

        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
        var result = await connection.QuerySingleAsync<dynamic>(sql);

        decimal totalDeposits = (decimal)(result.total_deposits ?? 0m);
        decimal totalPayouts = (decimal)(result.total_payouts ?? 0m);

        return new GlobalStatsResponse
        {
            TotalUsers = (int)(result.total_users ?? 0),
            TotalInvested = (decimal)(result.total_invested ?? 0m),
            ActiveInvestmentsCount = (int)(result.active_investments_count ?? 0),
            TotalProfitPaid = (decimal)(result.total_profit_paid ?? 0m),
            TotalReferralPaid = (decimal)(result.total_referral_paid ?? 0m),
            SystemReserve = totalDeposits - totalPayouts,
            GeneratedAt = DateTime.UtcNow
        };
    }

    public async Task<IEnumerable<UserListItem>> GetAllUsersAsync(CancellationToken cancellationToken = default)
    {
        const string sql = @"
            SELECT 
                u.id, u.username, u.email, u.balance, u.created_at,
                (SELECT COUNT(*) FROM investments WHERE user_id = u.id AND is_active = true) AS investments_count,
                (SELECT COALESCE(SUM(amount), 0) FROM investments WHERE user_id = u.id AND is_active = true) AS total_invested,
                (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE user_id = u.id AND type IN ('Profit', 'ReferralBonus')) AS total_earned,
                (SELECT COUNT(*) FROM users WHERE referrer_id = u.id) AS referrals_count
            FROM users u ORDER BY u.created_at DESC";

        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
        return await connection.QueryAsync<UserListItem>(sql);
    }

    public async Task<IEnumerable<InvestmentInfoResponse>> GetRecentInvestmentsAsync(int limit = 20, CancellationToken cancellationToken = default)
    {
        const string sql = @"
            SELECT i.id, i.user_id, u.username, u.email, i.amount, i.daily_rate,
                   (i.amount * i.daily_rate) AS daily_payout, i.created_at, i.next_payout_at, i.is_active
            FROM investments i INNER JOIN users u ON u.id = i.user_id
            ORDER BY i.created_at DESC LIMIT @Limit";

        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
        return await connection.QueryAsync<InvestmentInfoResponse>(sql, new { Limit = limit });
    }

    public async Task<UserFullDetailsResponse?> GetUserFullDetailsAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);

        const string userSql = @"
            SELECT u.id, u.username, u.email, u.balance, u.referrer_id, u.created_at,
                   r.username AS referrer_username
            FROM users u LEFT JOIN users r ON r.id = u.referrer_id WHERE u.id = @UserId";
        var userResult = await connection.QuerySingleOrDefaultAsync<dynamic>(userSql, new { UserId = userId });
        if (userResult == null) return null;

        var transactions = await connection.QueryAsync<TransactionDetail>(
            "SELECT id, amount, type, description, created_at FROM transactions WHERE user_id = @UserId ORDER BY created_at DESC LIMIT 100",
            new { UserId = userId });

        var investments = await connection.QueryAsync<InvestmentDetail>(
            "SELECT id, amount, daily_rate, (amount * daily_rate) AS daily_payout, created_at, next_payout_at, is_active FROM investments WHERE user_id = @UserId ORDER BY created_at DESC",
            new { UserId = userId });

        var notifications = await connection.QueryAsync<NotificationDetail>(
            "SELECT id, message, is_read, created_at FROM notifications WHERE user_id = @UserId ORDER BY created_at DESC LIMIT 50",
            new { UserId = userId });

        var referrals = await connection.QueryAsync<ReferralUser>(
            "SELECT id, username, created_at AS joined_at FROM users WHERE referrer_id = @UserId ORDER BY created_at DESC",
            new { UserId = userId });

        return new UserFullDetailsResponse
        {
            Profile = new UserProfile
            {
                Id = (Guid)userResult.id,
                Username = (string)userResult.username,
                Email = (string)userResult.email,
                Balance = (decimal)userResult.balance,
                ReferrerId = userResult.referrer_id as Guid?,
                ReferrerUsername = userResult.referrer_username as string,
                CreatedAt = (DateTime)userResult.created_at
            },
            Transactions = transactions.ToList(),
            Investments = investments.ToList(),
            Notifications = notifications.ToList(),
            Referrals = new ReferralInfo { TotalReferrals = referrals.Count(), Referrals = referrals.ToList() }
        };
    }

    public async Task<bool> AdjustUserBalanceAsync(Guid userId, decimal amount, string reason, CancellationToken cancellationToken = default)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
        using var transaction = connection.BeginTransaction();
        try
        {
            const string lockSql = "SELECT balance FROM users WHERE id = @UserId FOR UPDATE";
            var balance = await connection.QuerySingleOrDefaultAsync<decimal?>(lockSql, new { UserId = userId }, transaction);
            if (balance == null) { transaction.Rollback(); return false; }
            if (balance + amount < 0) { transaction.Rollback(); return false; }

            const string updateSql = "UPDATE users SET balance = balance + @Amount WHERE id = @UserId";
            await connection.ExecuteAsync(updateSql, new { Amount = amount, UserId = userId }, transaction);

            var tx = Transaction.Create(userId, amount, Transaction.Types.ManualAdjustment, $"Admin adjustment: {reason}");
            const string insertTxSql = @"
                INSERT INTO transactions (id, user_id, amount, type, description, created_at)
                VALUES (@Id, @UserId, @Amount, @Type, @Description, @CreatedAt)";
            await connection.ExecuteAsync(insertTxSql, new { tx.Id, tx.UserId, tx.Amount, tx.Type, tx.Description, tx.CreatedAt }, transaction);

            var notif = Notification.Create(userId,
                amount >= 0
                    ? $"⚡ Администратор начислил вам ${amount:F2}. Причина: {reason}"
                    : $"⚡ Администратор списал ${Math.Abs(amount):F2}. Причина: {reason}");
            const string notifSql = @"
                INSERT INTO notifications (id, user_id, message, is_read, created_at)
                VALUES (@Id, @UserId, @Message, @IsRead, @CreatedAt)";
            await connection.ExecuteAsync(notifSql, new { notif.Id, notif.UserId, notif.Message, notif.IsRead, notif.CreatedAt }, transaction);

            transaction.Commit();
            return true;
        }
        catch { transaction.Rollback(); throw; }
    }

    // ============== INVESTMENT PLANS CRUD ==============

    public async Task<IEnumerable<InvestmentPlanDto>> GetAllPlansAsync(CancellationToken cancellationToken = default)
    {
        const string sql = @"
            SELECT p.*,
                (SELECT COUNT(*) FROM investments i 
                 WHERE i.is_active = true AND i.daily_rate = p.daily_rate 
                   AND i.amount >= p.min_amount AND i.amount <= p.max_amount) AS active_investments,
                (SELECT COALESCE(SUM(i.amount), 0) FROM investments i 
                 WHERE i.is_active = true AND i.daily_rate = p.daily_rate 
                   AND i.amount >= p.min_amount AND i.amount <= p.max_amount) AS total_invested
            FROM investment_plans p
            ORDER BY p.sort_order ASC, p.created_at ASC";

        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
        return await connection.QueryAsync<InvestmentPlanDto>(sql);
    }

    public async Task<InvestmentPlanDto?> GetPlanByIdAsync(Guid planId, CancellationToken cancellationToken = default)
    {
        const string sql = @"
            SELECT p.*,
                (SELECT COUNT(*) FROM investments i 
                 WHERE i.is_active = true AND i.daily_rate = p.daily_rate 
                   AND i.amount >= p.min_amount AND i.amount <= p.max_amount) AS active_investments,
                (SELECT COALESCE(SUM(i.amount), 0) FROM investments i 
                 WHERE i.is_active = true AND i.daily_rate = p.daily_rate 
                   AND i.amount >= p.min_amount AND i.amount <= p.max_amount) AS total_invested
            FROM investment_plans p WHERE p.id = @PlanId";

        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
        return await connection.QuerySingleOrDefaultAsync<InvestmentPlanDto>(sql, new { PlanId = planId });
    }

    public async Task<InvestmentPlan> CreatePlanAsync(CreatePlanRequest request, CancellationToken cancellationToken = default)
    {
        var plan = new InvestmentPlan
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            MinAmount = request.MinAmount,
            MaxAmount = request.MaxAmount,
            DailyRate = request.DailyRate,
            DurationDays = request.DurationDays,
            IsActive = true,
            Description = request.Description.Trim(),
            Color = request.Color,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        // Auto-assign sort order
        const string maxSortSql = "SELECT COALESCE(MAX(sort_order), 0) + 1 FROM investment_plans";
        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
        plan.SortOrder = await connection.QuerySingleAsync<int>(maxSortSql);

        const string sql = @"
            INSERT INTO investment_plans (id, name, min_amount, max_amount, daily_rate, duration_days, is_active, sort_order, description, color, created_at, updated_at)
            VALUES (@Id, @Name, @MinAmount, @MaxAmount, @DailyRate, @DurationDays, @IsActive, @SortOrder, @Description, @Color, @CreatedAt, @UpdatedAt)";

        await connection.ExecuteAsync(sql, plan);
        return plan;
    }

    public async Task<bool> UpdatePlanAsync(Guid planId, UpdatePlanRequest request, CancellationToken cancellationToken = default)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);

        var existing = await connection.QuerySingleOrDefaultAsync<InvestmentPlan>(
            "SELECT * FROM investment_plans WHERE id = @PlanId", new { PlanId = planId });
        if (existing == null) return false;

        const string sql = @"
            UPDATE investment_plans SET
                name = @Name, min_amount = @MinAmount, max_amount = @MaxAmount,
                daily_rate = @DailyRate, duration_days = @DurationDays, is_active = @IsActive,
                description = @Description, color = @Color, updated_at = @UpdatedAt
            WHERE id = @PlanId";

        await connection.ExecuteAsync(sql, new
        {
            PlanId = planId,
            Name = request.Name?.Trim() ?? existing.Name,
            MinAmount = request.MinAmount ?? existing.MinAmount,
            MaxAmount = request.MaxAmount ?? existing.MaxAmount,
            DailyRate = request.DailyRate ?? existing.DailyRate,
            DurationDays = request.DurationDays ?? existing.DurationDays,
            IsActive = request.IsActive ?? existing.IsActive,
            Description = request.Description?.Trim() ?? existing.Description,
            Color = request.Color ?? existing.Color,
            UpdatedAt = DateTime.UtcNow
        });

        return true;
    }

    public async Task<bool> DeletePlanAsync(Guid planId, CancellationToken cancellationToken = default)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
        var rows = await connection.ExecuteAsync(
            "DELETE FROM investment_plans WHERE id = @PlanId", new { PlanId = planId });
        return rows > 0;
    }

    // ============== ANALYTICS ==============

    public async Task<AnalyticsResponse> GetAnalyticsAsync(int days = 14, CancellationToken cancellationToken = default)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);

        // 1. Daily stats for the last N days
        const string dailySql = @"
            WITH dates AS (
                SELECT generate_series(
                    (CURRENT_DATE - @Days * INTERVAL '1 day')::date,
                    CURRENT_DATE::date,
                    '1 day'::interval
                )::date AS d
            )
            SELECT 
                TO_CHAR(dates.d, 'MM/DD') AS date,
                COALESCE(SUM(CASE WHEN t.type = 'Deposit' THEN t.amount ELSE 0 END), 0) AS deposits,
                COALESCE(SUM(CASE WHEN t.type = 'Withdrawal' THEN ABS(t.amount) ELSE 0 END), 0) AS withdrawals,
                COALESCE(SUM(CASE WHEN t.type = 'Profit' THEN t.amount ELSE 0 END), 0) AS profit_paid,
                COALESCE(SUM(CASE WHEN t.type = 'ReferralBonus' THEN t.amount ELSE 0 END), 0) AS referral_paid,
                (SELECT COUNT(*) FROM users u WHERE u.created_at::date = dates.d) AS new_users,
                (SELECT COUNT(*) FROM investments i WHERE i.created_at::date = dates.d) AS new_investments
            FROM dates
            LEFT JOIN transactions t ON t.created_at::date = dates.d
            GROUP BY dates.d ORDER BY dates.d ASC";

        var dailyStats = (await connection.QueryAsync<DailyStatPoint>(dailySql, new { Days = days })).ToList();

        // 2. Plan distribution
        const string planDistSql = @"
            SELECT 
                p.name, p.color,
                COUNT(i.id) AS count,
                COALESCE(SUM(i.amount), 0) AS total_amount
            FROM investment_plans p
            LEFT JOIN investments i ON i.is_active = true 
                AND i.daily_rate = p.daily_rate 
                AND i.amount >= p.min_amount AND i.amount <= p.max_amount
            WHERE p.is_active = true
            GROUP BY p.id, p.name, p.color, p.sort_order
            ORDER BY p.sort_order";

        var planDist = (await connection.QueryAsync<PlanDistribution>(planDistSql)).ToList();

        // 3. Financial summary
        const string financialSql = @"
            SELECT
                COALESCE(SUM(CASE WHEN type = 'Deposit' THEN amount ELSE 0 END), 0) AS total_deposits,
                COALESCE(SUM(CASE WHEN type = 'Withdrawal' AND status = 'Completed' THEN ABS(amount) ELSE 0 END), 0) AS total_withdrawals,
                COALESCE(SUM(CASE WHEN type = 'Profit' THEN amount ELSE 0 END), 0) AS total_profit_paid,
                COALESCE(SUM(CASE WHEN type = 'ReferralBonus' THEN amount ELSE 0 END), 0) AS total_referral_paid,
                COALESCE(SUM(CASE WHEN type = 'Withdrawal' AND status = 'Pending' THEN ABS(amount) ELSE 0 END), 0) AS pending_withdrawals
            FROM transactions";

        var fin = await connection.QuerySingleAsync<dynamic>(financialSql);

        decimal totalDeposits = (decimal)(fin.total_deposits ?? 0m);
        decimal totalWithdrawals = (decimal)(fin.total_withdrawals ?? 0m);
        decimal totalProfitPaid = (decimal)(fin.total_profit_paid ?? 0m);
        decimal totalReferralPaid = (decimal)(fin.total_referral_paid ?? 0m);
        decimal pendingWithdrawals = (decimal)(fin.pending_withdrawals ?? 0m);

        decimal activeInvestmentsTotal = await connection.QuerySingleAsync<decimal>(
            "SELECT COALESCE(SUM(amount), 0) FROM investments WHERE is_active = true");

        var financial = new FinancialSummary
        {
            TotalDeposits = totalDeposits,
            TotalWithdrawals = totalWithdrawals,
            TotalProfitPaid = totalProfitPaid,
            TotalReferralPaid = totalReferralPaid,
            PlatformRevenue = totalDeposits - totalProfitPaid - totalReferralPaid - totalWithdrawals,
            PendingWithdrawals = pendingWithdrawals,
            ActiveInvestmentsTotal = activeInvestmentsTotal
        };

        // 4. User growth
        const string userGrowthSql = @"
            SELECT 
                COUNT(*) AS total_users,
                SUM(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 ELSE 0 END) AS new_users_week,
                SUM(CASE WHEN created_at::date = CURRENT_DATE THEN 1 ELSE 0 END) AS new_users_today
            FROM users";

        var ug = await connection.QuerySingleAsync<dynamic>(userGrowthSql);

        int activeUsers7d = await connection.QuerySingleAsync<int>(
            @"SELECT COUNT(DISTINCT user_id) FROM transactions WHERE created_at >= NOW() - INTERVAL '7 days'");

        // Rank distribution
        var rankRows = await connection.QueryAsync<(int status, int count)>(
            "SELECT status, COUNT(*) AS count FROM users GROUP BY status ORDER BY status");
        var rankDist = new Dictionary<string, int>();
        foreach (var r in rankRows)
        {
            var rankName = r.status switch { 0 => "Bronze", 1 => "Silver", 2 => "Gold", 3 => "Platinum", _ => "Unknown" };
            rankDist[rankName] = r.count;
        }

        var userGrowth = new UserGrowth
        {
            TotalUsers = (int)(ug.total_users ?? 0),
            ActiveUsers7d = activeUsers7d,
            NewUsersToday = (int)(ug.new_users_today ?? 0L),
            NewUsersWeek = (int)(ug.new_users_week ?? 0L),
            RankDistribution = rankDist
        };

        return new AnalyticsResponse
        {
            DailyStats = dailyStats,
            PlanDistribution = planDist,
            Financial = financial,
            UserGrowth = userGrowth
        };
    }
}
