using System.Globalization;
using Dapper;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Tradyx.Core.Entities;
using Tradyx.Core.Interfaces;

namespace Tradyx.Infrastructure.Services;

public class WithdrawalService : IWithdrawalService
{
    private readonly IDbConnectionFactory _connectionFactory;
    private readonly IRealtimeNotifier _realtime;
    private readonly ITelegramNotifier _telegram;
    private readonly ILogger<WithdrawalService> _logger;

    private readonly decimal _instantFeeRate;
    private readonly decimal _instantMaxAmount;
    private readonly decimal _minAmount;
    private readonly Dictionary<UserRank, decimal> _feeDiscounts;

    public WithdrawalService(
        IDbConnectionFactory connectionFactory,
        IRealtimeNotifier realtime,
        ITelegramNotifier telegram,
        IConfiguration configuration,
        ILogger<WithdrawalService> logger)
    {
        _connectionFactory = connectionFactory;
        _realtime = realtime;
        _telegram = telegram;
        _logger = logger;

        var s = configuration.GetSection("WithdrawalSettings");
        _instantFeeRate = ParseDec(s["InstantFeeRate"], 0.07m);
        _instantMaxAmount = ParseDec(s["InstantMaxAmount"], 500m);
        _minAmount = ParseDec(s["MinAmount"], 10m);

        _feeDiscounts = new()
        {
            [UserRank.Bronze]   = ParseDec(s["FeeDiscounts:Bronze"], 0m),
            [UserRank.Silver]   = ParseDec(s["FeeDiscounts:Silver"], 0m),
            [UserRank.Gold]     = ParseDec(s["FeeDiscounts:Gold"], 0.15m),
            [UserRank.Platinum] = ParseDec(s["FeeDiscounts:Platinum"], 0.30m),
        };

        _logger.LogInformation("[Withdrawal] Fee={Fee}%, Max=${Max}, Discounts: Gold={G}%, Plat={P}%",
            _instantFeeRate * 100, _instantMaxAmount,
            _feeDiscounts[UserRank.Gold] * 100, _feeDiscounts[UserRank.Platinum] * 100);
    }

    public async Task<WithdrawalResult> RequestWithdrawalAsync(
        Guid userId, decimal amount, bool isInstant, string? walletAddress,
        CancellationToken cancellationToken = default)
    {
        if (amount < _minAmount)
            return new WithdrawalResult(false, $"Minimum withdrawal is ${_minAmount:F0}");

        using var conn = await _connectionFactory.CreateConnectionAsync(cancellationToken);
        using var tx = conn.BeginTransaction();

        try
        {
            // ===  SECURITY: Check for existing pending withdrawal ===
            var pendingCount = await conn.QuerySingleAsync<int>(
                "SELECT COUNT(*) FROM transactions WHERE user_id = @UserId AND type = 'Withdrawal' AND status = 'Pending'",
                new { UserId = userId }, tx);
            if (pendingCount > 0)
                return new WithdrawalResult(false, "You already have a pending withdrawal. Wait for it to be processed.");

            // Get user with row lock
            var user = await conn.QuerySingleOrDefaultAsync<(decimal Balance, int Status)>(
                "SELECT balance, status FROM users WHERE id = @UserId FOR UPDATE",
                new { UserId = userId }, tx);
            if (user == default)
                return new WithdrawalResult(false, "User not found");

            var rank = (UserRank)user.Status;

            if (isInstant)
            {
                // === INSTANT withdrawal ===
                if (amount > _instantMaxAmount)
                    return new WithdrawalResult(false, $"Instant withdrawal limit is ${_instantMaxAmount:F0}");

                var discount = _feeDiscounts.GetValueOrDefault(rank, 0m);
                var effectiveFeeRate = _instantFeeRate * (1m - discount);
                var fee = Math.Round(amount * effectiveFeeRate, 2);
                var totalDeducted = amount + fee;

                if (user.Balance < totalDeducted)
                    return new WithdrawalResult(false,
                        $"Insufficient balance. Need ${totalDeducted:F2} (${amount:F2} + ${fee:F2} fee). You have ${user.Balance:F2}");

                // Deduct balance (amount + fee)
                await conn.ExecuteAsync(
                    "UPDATE users SET balance = balance - @Total WHERE id = @UserId",
                    new { Total = totalDeducted, UserId = userId }, tx);

                var discountLabel = discount > 0 ? $", {discount * 100:F0}% {rank} discount" : "";
                var desc = $"Instant withdrawal ${amount:F2} (fee ${fee:F2}{discountLabel})";

                var transaction = Transaction.CreateWithdrawal(
                    userId, amount, fee, true, walletAddress, Transaction.Statuses.Completed, desc);
                await InsertTransaction(conn, tx, transaction);

                // Notification
                var notif = Notification.Create(userId, $"⚡ Мгновенный вывод ${amount:F2} обработан (комиссия ${fee:F2})");
                await InsertNotification(conn, tx, notif);

                tx.Commit();

                _logger.LogInformation("[Withdrawal] Instant: ${Amount} (fee ${Fee}) for user {UserId} ({Rank})",
                    amount, fee, userId, rank);

                // SignalR + Telegram
                _ = PushWithdrawalEvents(userId, amount, "Completed");
                _ = _telegram.NotifyAsync($"⚡ <b>Мгновенный вывод</b>\nСумма: <b>${amount:F2}</b> (комиссия ${fee:F2})\nСтатус: ✅ Completed");

                return new WithdrawalResult(true, null, transaction.Id, amount, fee, "Completed");
            }
            else
            {
                // === REGULAR withdrawal (pending queue) ===
                if (user.Balance < amount)
                    return new WithdrawalResult(false,
                        $"Insufficient balance. You have ${user.Balance:F2}");

                // Freeze balance (deduct immediately, funds in limbo until approved/rejected)
                await conn.ExecuteAsync(
                    "UPDATE users SET balance = balance - @Amount WHERE id = @UserId",
                    new { Amount = amount, UserId = userId }, tx);

                var desc = $"Withdrawal ${amount:F2} (pending admin approval)";
                var transaction = Transaction.CreateWithdrawal(
                    userId, amount, 0m, false, walletAddress, Transaction.Statuses.Pending, desc);
                await InsertTransaction(conn, tx, transaction);

                var notif = Notification.Create(userId,
                    $"⏳ Заявка на вывод ${amount:F2} создана. Ожидание подтверждения (1-3 дня).");
                await InsertNotification(conn, tx, notif);

                tx.Commit();

                _logger.LogInformation("[Withdrawal] Regular (Pending): ${Amount} for user {UserId}", amount, userId);

                _ = PushWithdrawalEvents(userId, amount, "Pending");
                _ = _telegram.NotifyAsync($"💸 <b>Заявка на вывод</b>\nСумма: <b>${amount:F2}</b>\nТип: 🐢 Regular (ожидает одобрения)");

                return new WithdrawalResult(true, null, transaction.Id, amount, 0, "Pending");
            }
        }
        catch
        {
            tx.Rollback();
            throw;
        }
    }

    public async Task<IEnumerable<PendingWithdrawalDto>> GetPendingWithdrawalsAsync(CancellationToken cancellationToken = default)
    {
        using var conn = await _connectionFactory.CreateConnectionAsync(cancellationToken);
        const string sql = @"
            SELECT t.id, t.user_id, u.username, u.email,
                   ABS(t.amount) AS amount, t.fee_amount, t.is_instant, t.wallet_address, t.created_at
            FROM transactions t
            JOIN users u ON u.id = t.user_id
            WHERE t.type = 'Withdrawal' AND t.status = 'Pending'
            ORDER BY t.created_at ASC";
        return await conn.QueryAsync<PendingWithdrawalDto>(sql);
    }

    public async Task<(bool Success, string? Error)> ApproveWithdrawalAsync(Guid transactionId, CancellationToken cancellationToken = default)
    {
        using var conn = await _connectionFactory.CreateConnectionAsync(cancellationToken);
        using var tx = conn.BeginTransaction();

        try
        {
            var row = await conn.QuerySingleOrDefaultAsync<(Guid UserId, decimal Amount, string Status)>(
                "SELECT user_id, amount, status FROM transactions WHERE id = @Id FOR UPDATE",
                new { Id = transactionId }, tx);

            if (row == default) return (false, "Transaction not found");
            if (row.Status != Transaction.Statuses.Pending) return (false, $"Transaction is already {row.Status}");

            // Mark as Completed
            await conn.ExecuteAsync(
                "UPDATE transactions SET status = 'Completed', description = description || ' — Approved' WHERE id = @Id",
                new { Id = transactionId }, tx);

            // Notification
            var absAmount = Math.Abs(row.Amount);
            var notif = Notification.Create(row.UserId,
                $"✅ Ваша заявка на вывод ${absAmount:F2} одобрена и отправлена!");
            await InsertNotification(conn, tx, notif);

            tx.Commit();

            _logger.LogWarning("[Withdrawal] APPROVED tx {TxId} for user {UserId}, ${Amount:F2}",
                transactionId, row.UserId, absAmount);

            // SignalR + Telegram
            _ = Task.Run(async () =>
            {
                try
                {
                    var balance = await GetUserBalance(row.UserId);
                    await _realtime.NotifyBalanceUpdated(row.UserId, balance);
                    await _realtime.NotifyNewNotification(row.UserId,
                        $"✅ Withdrawal ${absAmount:F2} approved!");
                    await _realtime.NotifyTransactionCreated(row.UserId, "Withdrawal", -absAmount);
                }
                catch { /* non-critical */ }
            });
            _ = _telegram.NotifyAsync($"✅ <b>Вывод одобрен</b>\nСумма: <b>${absAmount:F2}</b>");

            return (true, null);
        }
        catch
        {
            tx.Rollback();
            throw;
        }
    }

    public async Task<(bool Success, string? Error)> RejectWithdrawalAsync(Guid transactionId, string? reason, CancellationToken cancellationToken = default)
    {
        using var conn = await _connectionFactory.CreateConnectionAsync(cancellationToken);
        using var tx = conn.BeginTransaction();

        try
        {
            var row = await conn.QuerySingleOrDefaultAsync<(Guid UserId, decimal Amount, string Status)>(
                "SELECT user_id, amount, status FROM transactions WHERE id = @Id FOR UPDATE",
                new { Id = transactionId }, tx);

            if (row == default) return (false, "Transaction not found");
            if (row.Status != Transaction.Statuses.Pending) return (false, $"Transaction is already {row.Status}");

            var absAmount = Math.Abs(row.Amount);
            var reasonLabel = string.IsNullOrWhiteSpace(reason) ? "No reason given" : reason;

            // Mark as Rejected
            await conn.ExecuteAsync(
                "UPDATE transactions SET status = 'Rejected', description = description || ' — Rejected: ' || @Reason WHERE id = @Id",
                new { Id = transactionId, Reason = reasonLabel }, tx);

            // REFUND balance
            await conn.ExecuteAsync(
                "UPDATE users SET balance = balance + @Amount WHERE id = @UserId",
                new { Amount = absAmount, UserId = row.UserId }, tx);

            // Notification
            var notif = Notification.Create(row.UserId,
                $"❌ Заявка на вывод ${absAmount:F2} отклонена: {reasonLabel}. Средства возвращены на баланс.");
            await InsertNotification(conn, tx, notif);

            tx.Commit();

            _logger.LogWarning("[Withdrawal] REJECTED tx {TxId} for user {UserId}, ${Amount:F2}, reason: {Reason}",
                transactionId, row.UserId, absAmount, reasonLabel);

            // SignalR + Telegram
            _ = Task.Run(async () =>
            {
                try
                {
                    var balance = await GetUserBalance(row.UserId);
                    await _realtime.NotifyBalanceUpdated(row.UserId, balance);
                    await _realtime.NotifyNewNotification(row.UserId,
                        $"❌ Withdrawal ${absAmount:F2} rejected — funds refunded");
                    await _realtime.NotifyTransactionCreated(row.UserId, "Withdrawal", absAmount);
                }
                catch { /* non-critical */ }
            });
            _ = _telegram.NotifyAsync($"❌ <b>Вывод отклонён</b>\nСумма: <b>${absAmount:F2}</b>\nПричина: {reasonLabel}");

            return (true, null);
        }
        catch
        {
            tx.Rollback();
            throw;
        }
    }

    public WithdrawalInfoDto GetWithdrawalInfo(int userRank)
    {
        var rank = (UserRank)userRank;
        var discount = _feeDiscounts.GetValueOrDefault(rank, 0m);
        return new WithdrawalInfoDto(_instantFeeRate, _instantMaxAmount, _minAmount, discount);
    }

    // === Helpers ===

    private async Task<decimal> GetUserBalance(Guid userId)
    {
        using var c = await _connectionFactory.CreateConnectionAsync();
        return await c.QuerySingleAsync<decimal>("SELECT balance FROM users WHERE id = @UserId", new { UserId = userId });
    }

    private async Task PushWithdrawalEvents(Guid userId, decimal amount, string status)
    {
        try
        {
            var balance = await GetUserBalance(userId);
            await _realtime.NotifyBalanceUpdated(userId, balance);
            await _realtime.NotifyTransactionCreated(userId, "Withdrawal", -amount);
            await _realtime.NotifyNewNotification(userId,
                status == "Completed"
                    ? $"⚡ Instant withdrawal ${amount:F2} completed"
                    : $"⏳ Withdrawal ${amount:F2} pending approval");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[Withdrawal] SignalR push failed for {UserId}", userId);
        }
    }

    private static async Task InsertTransaction(System.Data.IDbConnection conn, System.Data.IDbTransaction tx, Transaction t)
    {
        await conn.ExecuteAsync(@"
            INSERT INTO transactions (id, user_id, amount, type, description, status, fee_amount, is_instant, wallet_address, created_at)
            VALUES (@Id, @UserId, @Amount, @Type, @Description, @Status, @FeeAmount, @IsInstant, @WalletAddress, @CreatedAt)", t, tx);
    }

    private static async Task InsertNotification(System.Data.IDbConnection conn, System.Data.IDbTransaction tx, Notification n)
    {
        await conn.ExecuteAsync(@"
            INSERT INTO notifications (id, user_id, message, is_read, created_at)
            VALUES (@Id, @UserId, @Message, @IsRead, @CreatedAt)",
            new { n.Id, n.UserId, n.Message, n.IsRead, n.CreatedAt }, tx);
    }

    private static decimal ParseDec(string? s, decimal fallback) =>
        decimal.TryParse(s, NumberStyles.Any, CultureInfo.InvariantCulture, out var v) ? v : fallback;
}
