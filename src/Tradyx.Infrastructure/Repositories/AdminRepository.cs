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
            // Row-lock + negative balance guard
            const string lockSql = "SELECT balance FROM users WHERE id = @UserId FOR UPDATE";
            var balance = await connection.QuerySingleOrDefaultAsync<decimal?>(lockSql, new { UserId = userId }, transaction);
            if (balance == null) { transaction.Rollback(); return false; }
            if (balance + amount < 0) { transaction.Rollback(); return false; } // would go negative

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
}
