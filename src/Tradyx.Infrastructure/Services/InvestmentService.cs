using System.Globalization;
using Dapper;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Tradyx.Core.DTOs;
using Tradyx.Core.Entities;
using Tradyx.Core.Interfaces;
using Tradyx.Infrastructure.Repositories;

namespace Tradyx.Infrastructure.Services;

public class InvestmentService : IInvestmentService
{
    private readonly IDbConnectionFactory _connectionFactory;
    private readonly InvestmentRepository _investmentRepository;
    private readonly TransactionRepository _transactionRepository;
    private readonly NotificationRepository _notificationRepository;
    private readonly IRankService _rankService;
    private readonly IRealtimeNotifier _realtime;
    private readonly ITelegramNotifier _telegram;
    private readonly ILogger<InvestmentService> _logger;

    private readonly decimal _earlyExitFee;
    private readonly int _minLockDays;

    public InvestmentService(
        IDbConnectionFactory connectionFactory,
        InvestmentRepository investmentRepository,
        TransactionRepository transactionRepository,
        NotificationRepository notificationRepository,
        IRankService rankService,
        IRealtimeNotifier realtime,
        ITelegramNotifier telegram,
        IConfiguration configuration,
        ILogger<InvestmentService> logger)
    {
        _connectionFactory = connectionFactory;
        _investmentRepository = investmentRepository;
        _transactionRepository = transactionRepository;
        _notificationRepository = notificationRepository;
        _rankService = rankService;
        _realtime = realtime;
        _telegram = telegram;
        _logger = logger;

        var s = configuration.GetSection("InvestmentSettings");
        _earlyExitFee = ParseDec(s["EarlyExitFee"], 0.15m);
        _minLockDays = int.TryParse(s["MinLockDays"], out var d) ? d : 21;

        _logger.LogInformation("[Investment] EarlyExit: fee={Fee}%, lockDays={Days}",
            _earlyExitFee * 100, _minLockDays);
    }

    private static decimal ParseDec(string? s, decimal fallback) =>
        decimal.TryParse(s, NumberStyles.Any, CultureInfo.InvariantCulture, out var v) ? v : fallback;

    public async Task<IEnumerable<InvestmentPlan>> GetActivePlansAsync(CancellationToken cancellationToken = default)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
        return await connection.QueryAsync<InvestmentPlan>(
            "SELECT * FROM investment_plans WHERE is_active = true ORDER BY sort_order ASC, created_at ASC");
    }

    public async Task<InvestmentResponse> PurchaseAsync(Guid userId, decimal amount, CancellationToken cancellationToken = default)
    {
        if (amount < 1)
            return InvestmentResponse.Fail("Invalid investment amount");

        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);

        // Find matching plan from DB
        var plan = await connection.QuerySingleOrDefaultAsync<InvestmentPlan>(
            @"SELECT * FROM investment_plans 
              WHERE is_active = true AND @Amount >= min_amount AND @Amount <= max_amount 
              ORDER BY daily_rate DESC LIMIT 1",
            new { Amount = amount });

        if (plan == null)
            return InvestmentResponse.Fail($"No investment plan found for ${amount:F2}. Check available plans.");

        using var transaction = connection.BeginTransaction();

        try
        {
            // Check & deduct balance
            const string checkSql = "SELECT balance, status FROM users WHERE id = @UserId FOR UPDATE";
            var row = await connection.QuerySingleOrDefaultAsync<(decimal Balance, int Status)?>(
                checkSql, new { UserId = userId }, transaction);
            if (row == null) return InvestmentResponse.Fail("User not found");
            if (row.Value.Balance < amount) return InvestmentResponse.Fail($"Insufficient balance. You have ${row.Value.Balance:F2}");

            // Deduct balance
            await connection.ExecuteAsync(
                "UPDATE users SET balance = balance - @Amount WHERE id = @UserId",
                new { Amount = amount, UserId = userId }, transaction);

            // Create investment using plan duration
            var investment = new Investment
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                Amount = amount,
                DailyRate = plan.DailyRate,
                CreatedAt = DateTime.UtcNow,
                NextPayoutAt = DateTime.UtcNow.AddMinutes(2),
                IsActive = true,
                RemainingPayouts = plan.DurationDays
            };
            await _investmentRepository.AddAsync(investment, connection, transaction);

            // Transaction record
            var tx = Transaction.Create(userId, -amount, Transaction.Types.Investment,
                $"Investment ${amount:F2} — {plan.Name} ({plan.DailyRate * 100:F1}%/day, {plan.DurationDays}d)");
            await _transactionRepository.AddAsync(tx, connection, transaction);

            // Notification
            var notif = Notification.Create(userId,
                $"🎯 Инвестиция ${amount:F2} активирована! План: {plan.Name}, ставка: {plan.DailyRate * 100:F1}%/день, {plan.DurationDays} дней.");
            await _notificationRepository.AddAsync(notif, connection, transaction);

            // === Update turnovers (personal + team ancestors) ===
            await _rankService.UpdateTurnoversAsync(userId, amount, connection, transaction);

            // === Cashback for Gold+ users ===
            var rank = (UserRank)row.Value.Status;
            var cashbackRate = _rankService.GetCashbackRate(rank);
            if (cashbackRate > 0)
            {
                var cashback = Math.Round(amount * cashbackRate, 2);
                if (cashback > 0)
                {
                    await connection.ExecuteAsync(
                        "UPDATE users SET balance = balance + @Amount WHERE id = @UserId",
                        new { Amount = cashback, UserId = userId }, transaction);

                    var cbTx = Transaction.Create(userId, cashback, Transaction.Types.Cashback,
                        $"Cashback {cashbackRate * 100:F0}% from ${amount:F2} investment ({rank})");
                    await _transactionRepository.AddAsync(cbTx, connection, transaction);

                    var cbNotif = Notification.Create(userId,
                        $"💎 Кешбэк {cashbackRate * 100:F0}%: +${cashback:F2} за статус {rank}!");
                    await _notificationRepository.AddAsync(cbNotif, connection, transaction);

                    _logger.LogInformation("[Cashback] User {UserId} ({Rank}) got ${Cashback:F2} cashback on ${Amount:F2}",
                        userId, rank, cashback, amount);
                }
            }

            transaction.Commit();
            _logger.LogInformation("[Investment] User {UserId} invested ${Amount} in plan {Plan} at {Rate}%",
                userId, amount, plan.Name, plan.DailyRate * 100);

            // Telegram notification
            _ = _telegram.NotifyAsync(
                $"📈 <b>Новая инвестиция</b>\nПлан: {plan.Name}\nСумма: <b>${amount:F2}</b>\nСтавка: {plan.DailyRate * 100:F1}%/день\nДоход/день: ${amount * plan.DailyRate:F2}");

            // Check rank upgrade after commit (fire-and-forget)
            _ = Task.Run(async () =>
            {
                try { await _rankService.CheckAndUpgradeStatusAsync(userId, cancellationToken); }
                catch (Exception ex) { _logger.LogWarning(ex, "[Investment] Rank check failed for {UserId}", userId); }
            });

            return InvestmentResponse.Ok(investment.Id, amount, plan.DailyRate, investment.CreatedAt, investment.NextPayoutAt, investment.RemainingPayouts);
        }
        catch (Exception ex)
        {
            transaction.Rollback();
            _logger.LogError(ex, "[Investment] Purchase failed for user {UserId}, amount ${Amount:F2}", userId, amount);
            throw;
        }
    }

    public async Task<IEnumerable<InvestmentResponse>> GetUserInvestmentsAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var investments = await _investmentRepository.GetByUserIdAsync(userId, cancellationToken);
        return investments.Select(InvestmentResponse.FromEntity);
    }

    public async Task<EarlyExitResult> RequestEarlyExitAsync(Guid userId, Guid investmentId, CancellationToken cancellationToken = default)
    {
        using var conn = await _connectionFactory.CreateConnectionAsync(cancellationToken);
        using var tx = conn.BeginTransaction();

        try
        {
            // Lock the investment row
            var inv = await conn.QuerySingleOrDefaultAsync<(Guid Id, Guid UserId, decimal Amount, DateTime CreatedAt, bool IsActive, int RemainingPayouts)>(
                "SELECT id, user_id, amount, created_at, is_active, remaining_payouts FROM investments WHERE id = @Id FOR UPDATE",
                new { Id = investmentId }, tx);

            if (inv == default)
                return new EarlyExitResult(false, "Investment not found");
            if (inv.UserId != userId)
                return new EarlyExitResult(false, "Investment does not belong to you");
            if (!inv.IsActive)
                return new EarlyExitResult(false, "Investment is already closed");

            // Check 21-day lock
            var lockEnd = inv.CreatedAt.AddDays(_minLockDays);
            if (DateTime.UtcNow < lockEnd)
            {
                var remaining = lockEnd - DateTime.UtcNow;
                var daysLeft = (int)Math.Ceiling(remaining.TotalDays);
                var hoursLeft = (int)remaining.TotalHours % 24;
                return new EarlyExitResult(false,
                    $"Minimum {_minLockDays} days required. Available in {daysLeft}d {hoursLeft}h.");
            }

            // Calculate fee and return amount
            var fee = Math.Round(inv.Amount * _earlyExitFee, 2);
            var returnAmount = inv.Amount - fee;

            // Deactivate investment
            await conn.ExecuteAsync(
                "UPDATE investments SET is_active = false, remaining_payouts = 0 WHERE id = @Id",
                new { Id = investmentId }, tx);

            // Credit user balance
            await conn.ExecuteAsync(
                "UPDATE users SET balance = balance + @Amount WHERE id = @UserId",
                new { Amount = returnAmount, UserId = userId }, tx);

            // Transaction record
            var transaction = Transaction.Create(userId, returnAmount, Transaction.Types.Withdrawal,
                $"Early exit from investment (body ${inv.Amount:F2}, fee ${fee:F2} [{_earlyExitFee * 100:F0}%])");
            await _transactionRepository.AddAsync(transaction, conn, tx);

            // Notification
            var notif = Notification.Create(userId,
                $"💰 Досрочный возврат инвестиции: ${returnAmount:F2} зачислено (комиссия ${fee:F2})");
            await _notificationRepository.AddAsync(notif, conn, tx);

            tx.Commit();

            _logger.LogInformation("[Investment] Early exit: user {UserId}, inv {InvId}, body ${Body}, fee ${Fee}, returned ${Return}",
                userId, investmentId, inv.Amount, fee, returnAmount);

            // SignalR + Telegram
            _ = Task.Run(async () =>
            {
                try
                {
                    using var c = await _connectionFactory.CreateConnectionAsync();
                    var balance = await c.QuerySingleAsync<decimal>("SELECT balance FROM users WHERE id = @Id", new { Id = userId });
                    await _realtime.NotifyBalanceUpdated(userId, balance);
                    await _realtime.NotifyInvestmentUpdated(userId);
                    await _realtime.NotifyNewNotification(userId, $"💰 Early exit: ${returnAmount:F2} returned");
                }
                catch { }
            });

            _ = _telegram.NotifyAsync(
                $"💰 <b>Досрочный возврат</b>\n" +
                $"Сумма инвестиции: <b>${inv.Amount:F2}</b>\n" +
                $"Комиссия: ${fee:F2} ({_earlyExitFee * 100:F0}%)\n" +
                $"Возвращено: <b>${returnAmount:F2}</b>");

            return new EarlyExitResult(true, null, returnAmount, fee);
        }
        catch
        {
            tx.Rollback();
            throw;
        }
    }
}
