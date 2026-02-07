using Dapper;
using Microsoft.Extensions.Logging;
using Tradyx.Core.DTOs.User;
using Tradyx.Core.Entities;
using Tradyx.Core.Interfaces;

namespace Tradyx.Infrastructure.Repositories;

public class UserRepository : IUserRepository
{
    private readonly IDbConnectionFactory _connectionFactory;
    private readonly ILogger<UserRepository> _logger;

    public UserRepository(IDbConnectionFactory connectionFactory, ILogger<UserRepository> logger)
    {
        _connectionFactory = connectionFactory;
        _logger = logger;
    }

    public async Task<User?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        const string sql = "SELECT * FROM users WHERE id = @Id";
        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
        return await connection.QuerySingleOrDefaultAsync<User>(sql, new { Id = id });
    }

    public async Task<User?> GetByEmailAsync(string email, CancellationToken cancellationToken = default)
    {
        const string sql = "SELECT * FROM users WHERE LOWER(email) = LOWER(@Email)";
        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
        return await connection.QuerySingleOrDefaultAsync<User>(sql, new { Email = email });
    }

    public async Task<User?> GetByUsernameAsync(string username, CancellationToken cancellationToken = default)
    {
        const string sql = "SELECT * FROM users WHERE username = @Username";
        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
        return await connection.QuerySingleOrDefaultAsync<User>(sql, new { Username = username });
    }

    public async Task<User> CreateAsync(User user, CancellationToken cancellationToken = default)
    {
        const string sql = @"
            INSERT INTO users (id, username, email, password_hash, balance, referrer_id, created_at)
            VALUES (@Id, @Username, @Email, @PasswordHash, @Balance, @ReferrerId, @CreatedAt)
            RETURNING *";
        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
        return await connection.QuerySingleAsync<User>(sql, user);
    }

    public async Task<UserDashboardResponse?> GetDashboardAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        const string sql = @"
            SELECT
                u.balance,
                (SELECT COALESCE(SUM(amount), 0) FROM investments WHERE user_id = @UserId AND is_active = true) AS active_investments_amount,
                (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE user_id = @UserId AND type = 'Profit') AS total_earned,
                (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE user_id = @UserId AND type = 'Profit'
                    AND created_at >= CURRENT_DATE) AS today_profit,
                (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE user_id = @UserId AND type = 'ReferralBonus'
                    AND created_at >= CURRENT_DATE) AS today_referral_bonus,
                (SELECT COUNT(*) FROM users WHERE referrer_id = @UserId) AS referrals_count,
                (SELECT MIN(next_payout_at) FROM investments WHERE user_id = @UserId AND is_active = true) AS next_payout_at
            FROM users u WHERE u.id = @UserId";
        
        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
        return await connection.QuerySingleOrDefaultAsync<UserDashboardResponse>(sql, new { UserId = userId });
    }

    public async Task<bool> DepositAsync(Guid userId, decimal amount, CancellationToken cancellationToken = default)
    {
        if (amount <= 0) return false;

        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
        using var transaction = connection.BeginTransaction();

        try
        {
            // Row-lock to prevent concurrent balance races
            const string lockSql = "SELECT id FROM users WHERE id = @UserId FOR UPDATE";
            var exists = await connection.QuerySingleOrDefaultAsync<Guid?>(lockSql, new { UserId = userId }, transaction);
            if (exists == null) { transaction.Rollback(); return false; }

            // Update balance
            const string updateSql = "UPDATE users SET balance = balance + @Amount WHERE id = @UserId";
            await connection.ExecuteAsync(updateSql, new { Amount = amount, UserId = userId }, transaction);

            // Transaction record
            var tx = Transaction.Create(userId, amount, Transaction.Types.Deposit, $"Deposit of ${amount:F2}");
            const string insertSql = @"
                INSERT INTO transactions (id, user_id, amount, type, description, created_at)
                VALUES (@Id, @UserId, @Amount, @Type, @Description, @CreatedAt)";
            await connection.ExecuteAsync(insertSql, new { tx.Id, tx.UserId, tx.Amount, tx.Type, tx.Description, tx.CreatedAt }, transaction);

            // Notification
            var notif = Notification.Create(userId, $"💳 Ваш баланс пополнен на ${amount:F2}");
            const string notifSql = @"
                INSERT INTO notifications (id, user_id, message, is_read, created_at)
                VALUES (@Id, @UserId, @Message, @IsRead, @CreatedAt)";
            await connection.ExecuteAsync(notifSql, new { notif.Id, notif.UserId, notif.Message, notif.IsRead, notif.CreatedAt }, transaction);

            transaction.Commit();
            _logger.LogInformation("[UserRepo] Deposit ${Amount:F2} for user {UserId}", amount, userId);
            return true;
        }
        catch (Exception ex)
        {
            transaction.Rollback();
            _logger.LogError(ex, "[UserRepo] Deposit failed for user {UserId}, amount ${Amount:F2}", userId, amount);
            throw;
        }
    }

    public async Task<(bool Success, string? Error)> WithdrawAsync(Guid userId, decimal amount, string? walletAddress, CancellationToken cancellationToken = default)
    {
        if (amount <= 0) return (false, "Amount must be positive");

        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
        using var transaction = connection.BeginTransaction();

        try
        {
            // Row-lock + balance check
            const string checkSql = "SELECT balance FROM users WHERE id = @UserId FOR UPDATE";
            var balance = await connection.QuerySingleOrDefaultAsync<decimal?>(checkSql, new { UserId = userId }, transaction);
            if (balance == null) { transaction.Rollback(); return (false, "User not found"); }
            if (balance < amount) { transaction.Rollback(); return (false, $"Insufficient balance. You have ${balance:F2}"); }

            // Deduct balance
            const string updateSql = "UPDATE users SET balance = balance - @Amount WHERE id = @UserId";
            await connection.ExecuteAsync(updateSql, new { Amount = amount, UserId = userId }, transaction);

            // Transaction record (negative amount = outflow)
            var desc = string.IsNullOrEmpty(walletAddress)
                ? $"Withdrawal of ${amount:F2}"
                : $"Withdrawal of ${amount:F2} to {walletAddress}";
            var tx = Transaction.Create(userId, -amount, Transaction.Types.Withdrawal, desc);
            const string insertSql = @"
                INSERT INTO transactions (id, user_id, amount, type, description, created_at)
                VALUES (@Id, @UserId, @Amount, @Type, @Description, @CreatedAt)";
            await connection.ExecuteAsync(insertSql, new { tx.Id, tx.UserId, tx.Amount, tx.Type, tx.Description, tx.CreatedAt }, transaction);

            // Notification
            var notif = Notification.Create(userId, $"💸 Вывод ${amount:F2} обработан");
            const string notifSql = @"
                INSERT INTO notifications (id, user_id, message, is_read, created_at)
                VALUES (@Id, @UserId, @Message, @IsRead, @CreatedAt)";
            await connection.ExecuteAsync(notifSql, new { notif.Id, notif.UserId, notif.Message, notif.IsRead, notif.CreatedAt }, transaction);

            transaction.Commit();
            _logger.LogInformation("[UserRepo] Withdrawal ${Amount:F2} for user {UserId}", amount, userId);
            return (true, null);
        }
        catch (Exception ex)
        {
            transaction.Rollback();
            _logger.LogError(ex, "[UserRepo] Withdrawal failed for user {UserId}, amount ${Amount:F2}", userId, amount);
            throw;
        }
    }
}
