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
    private readonly ILogger<InvestmentService> _logger;

    public InvestmentService(
        IDbConnectionFactory connectionFactory,
        InvestmentRepository investmentRepository,
        TransactionRepository transactionRepository,
        NotificationRepository notificationRepository,
        ILogger<InvestmentService> logger)
    {
        _connectionFactory = connectionFactory;
        _investmentRepository = investmentRepository;
        _transactionRepository = transactionRepository;
        _notificationRepository = notificationRepository;
        _logger = logger;
    }

    public async Task<InvestmentResponse> PurchaseAsync(Guid userId, decimal amount, CancellationToken cancellationToken = default)
    {
        if (amount < 20)
            return InvestmentResponse.Fail("Minimum investment is $20");

        var dailyRate = Investment.GetDailyRate(amount);
        if (dailyRate == 0)
            return InvestmentResponse.Fail("Invalid investment amount");

        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
        using var transaction = connection.BeginTransaction();

        try
        {
            // Check & deduct balance
            const string checkSql = "SELECT balance FROM users WHERE id = @UserId FOR UPDATE";
            var balance = await connection.QuerySingleOrDefaultAsync<decimal?>(checkSql, new { UserId = userId }, transaction);
            if (balance == null) return InvestmentResponse.Fail("User not found");
            if (balance < amount) return InvestmentResponse.Fail($"Insufficient balance. You have ${balance:F2}");

            // Deduct balance
            const string deductSql = "UPDATE users SET balance = balance - @Amount WHERE id = @UserId";
            await connection.ExecuteAsync(deductSql, new { Amount = amount, UserId = userId }, transaction);

            // Create investment
            var investment = new Investment
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                Amount = amount,
                DailyRate = dailyRate,
                CreatedAt = DateTime.UtcNow,
                NextPayoutAt = DateTime.UtcNow.AddMinutes(2), // Demo mode: 2 min; Production: AddDays(1)
                IsActive = true
            };
            await _investmentRepository.AddAsync(investment, connection, transaction);

            // Transaction record (negative = expense)
            var tx = Transaction.Create(userId, -amount, Transaction.Types.Investment,
                $"Investment of ${amount:F2} at {dailyRate * 100:F1}% daily");
            await _transactionRepository.AddAsync(tx, connection, transaction);

            // Notification
            var notif = Notification.Create(userId,
                $"🎯 Инвестиция ${amount:F2} активирована! Ставка: {dailyRate * 100:F1}% в день.");
            await _notificationRepository.AddAsync(notif, connection, transaction);

            transaction.Commit();

            _logger.LogInformation("[Investment] User {UserId} invested ${Amount} at {Rate}%", userId, amount, dailyRate * 100);

            return InvestmentResponse.Ok(investment.Id, amount, dailyRate, investment.CreatedAt, investment.NextPayoutAt);
        }
        catch
        {
            transaction.Rollback();
            throw;
        }
    }

    public async Task<IEnumerable<InvestmentResponse>> GetUserInvestmentsAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var investments = await _investmentRepository.GetByUserIdAsync(userId, cancellationToken);
        return investments.Select(InvestmentResponse.FromEntity);
    }
}
