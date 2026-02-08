using Dapper;
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
    private readonly ILogger<InvestmentService> _logger;

    public InvestmentService(
        IDbConnectionFactory connectionFactory,
        InvestmentRepository investmentRepository,
        TransactionRepository transactionRepository,
        NotificationRepository notificationRepository,
        IRankService rankService,
        ILogger<InvestmentService> logger)
    {
        _connectionFactory = connectionFactory;
        _investmentRepository = investmentRepository;
        _transactionRepository = transactionRepository;
        _notificationRepository = notificationRepository;
        _rankService = rankService;
        _logger = logger;
    }

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
}
