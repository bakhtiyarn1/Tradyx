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

    public async Task<User?> GetByInviteCodeAsync(string inviteCode, CancellationToken cancellationToken = default)
    {
        const string sql = "SELECT * FROM users WHERE UPPER(invite_code) = UPPER(@InviteCode) AND invite_code != ''";
        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
        return await connection.QuerySingleOrDefaultAsync<User>(sql, new { InviteCode = inviteCode });
    }

    public async Task<User?> GetByTelegramIdAsync(long telegramId, CancellationToken cancellationToken = default)
    {
        const string sql = "SELECT * FROM users WHERE telegram_id = @TelegramId";
        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
        return await connection.QuerySingleOrDefaultAsync<User>(sql, new { TelegramId = telegramId });
    }

    public async Task<User> CreateAsync(User user, CancellationToken cancellationToken = default)
    {
        const string sql = @"
            INSERT INTO users (id, username, email, password_hash, balance, referrer_id, invite_code, referral_path,
                               telegram_id, registration_ip, is_suspicious, created_at)
            VALUES (@Id, @Username, @Email, @PasswordHash, @Balance, @ReferrerId, @InviteCode, @ReferralPath,
                    @TelegramId, @RegistrationIp, @IsSuspicious, @CreatedAt)
            RETURNING *";
        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
        return await connection.QuerySingleAsync<User>(sql, user);
    }

    public async Task<bool> LinkTelegramAsync(Guid userId, long telegramId, CancellationToken cancellationToken = default)
    {
        const string sql = "UPDATE users SET telegram_id = @TelegramId WHERE id = @UserId AND telegram_id IS NULL";
        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
        var rows = await connection.ExecuteAsync(sql, new { TelegramId = telegramId, UserId = userId });
        return rows > 0;
    }

    public async Task<UserDashboardResponse?> GetDashboardAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        const string sql = @"
            SELECT
                u.balance,
                u.invite_code,
                (SELECT COALESCE(SUM(amount), 0) FROM investments WHERE user_id = @UserId AND is_active = true) AS active_investments_amount,
                (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE user_id = @UserId AND type = 'Profit') AS total_earned,
                (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE user_id = @UserId AND type = 'Profit'
                    AND created_at >= CURRENT_DATE) AS today_profit,
                (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE user_id = @UserId AND type = 'ReferralBonus'
                    AND created_at >= CURRENT_DATE) AS today_referral_bonus,
                (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE user_id = @UserId AND type = 'ReferralBonus') AS total_referral_earned,
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

    public async Task<DepositResult> DepositWithInsuranceAsync(
        Guid userId, decimal grossAmount, ITreasuryService treasuryService, CancellationToken cancellationToken = default)
    {
        if (grossAmount <= 0) return new DepositResult(false, "Amount must be positive");

        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
        using var transaction = connection.BeginTransaction();

        try
        {
            // Row-lock
            const string lockSql = "SELECT id FROM users WHERE id = @UserId FOR UPDATE";
            var exists = await connection.QuerySingleOrDefaultAsync<Guid?>(lockSql, new { UserId = userId }, transaction);
            if (exists == null) { transaction.Rollback(); return new DepositResult(false, "User not found"); }

            // Process insurance fee (records InsuranceFee transaction inside the same DB tx)
            var (netAmount, insuranceFee) = await treasuryService.ProcessDepositInsuranceAsync(userId, grossAmount, connection, transaction);

            // Credit user balance with GROSS amount (full deposit), insurance is a separate platform fee
            const string updateSql = "UPDATE users SET balance = balance + @Amount WHERE id = @UserId";
            await connection.ExecuteAsync(updateSql, new { Amount = grossAmount, UserId = userId }, transaction);

            // Deposit transaction record (full gross amount)
            var tx = Transaction.Create(userId, grossAmount, Transaction.Types.Deposit,
                insuranceFee > 0
                    ? $"Deposit of ${grossAmount:F2} (${insuranceFee:F2} → insurance fund)"
                    : $"Deposit of ${grossAmount:F2}");
            const string insertSql = @"
                INSERT INTO transactions (id, user_id, amount, type, description, status, created_at)
                VALUES (@Id, @UserId, @Amount, @Type, @Description, 'Completed', @CreatedAt)";
            await connection.ExecuteAsync(insertSql, new { tx.Id, tx.UserId, tx.Amount, tx.Type, tx.Description, tx.CreatedAt }, transaction);

            // Notification
            var msg = insuranceFee > 0
                ? $"💳 Ваш баланс пополнен на ${grossAmount:F2} (${insuranceFee:F2} → страховой фонд)"
                : $"💳 Ваш баланс пополнен на ${grossAmount:F2}";
            var notif = Notification.Create(userId, msg);
            const string notifSql = @"
                INSERT INTO notifications (id, user_id, message, is_read, created_at)
                VALUES (@Id, @UserId, @Message, @IsRead, @CreatedAt)";
            await connection.ExecuteAsync(notifSql, new { notif.Id, notif.UserId, notif.Message, notif.IsRead, notif.CreatedAt }, transaction);

            transaction.Commit();
            _logger.LogInformation("[UserRepo] Deposit ${Gross:F2} (net=${Net:F2}, ins=${Fee:F2}) for user {UserId}",
                grossAmount, netAmount, insuranceFee, userId);
            return new DepositResult(true, null, netAmount, insuranceFee);
        }
        catch (Exception ex)
        {
            transaction.Rollback();
            _logger.LogError(ex, "[UserRepo] DepositWithInsurance failed for user {UserId}, amount ${Amount:F2}", userId, grossAmount);
            throw;
        }
    }

}
