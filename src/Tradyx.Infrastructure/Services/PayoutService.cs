using Dapper;
using Microsoft.Extensions.Logging;
using Tradyx.Core.Entities;
using Tradyx.Core.Interfaces;
using Tradyx.Infrastructure.Repositories;

namespace Tradyx.Infrastructure.Services;

public class PayoutService : IPayoutService
{
    private readonly IDbConnectionFactory _connectionFactory;
    private readonly InvestmentRepository _investmentRepository;
    private readonly TransactionRepository _transactionRepository;
    private readonly NotificationRepository _notificationRepository;
    private readonly ILogger<PayoutService> _logger;

    public PayoutService(
        IDbConnectionFactory connectionFactory,
        InvestmentRepository investmentRepository,
        TransactionRepository transactionRepository,
        NotificationRepository notificationRepository,
        ILogger<PayoutService> logger)
    {
        _connectionFactory = connectionFactory;
        _investmentRepository = investmentRepository;
        _transactionRepository = transactionRepository;
        _notificationRepository = notificationRepository;
        _logger = logger;
    }

    public async Task<int> ProcessPayoutsAsync(CancellationToken cancellationToken = default)
    {
        var dueInvestments = await _investmentRepository.GetDueForPayoutAsync(cancellationToken);
        var investments = dueInvestments.ToList();

        if (investments.Count == 0)
        {
            _logger.LogInformation("[PayoutService] No investments due for payout");
            return 0;
        }

        _logger.LogWarning("[PayoutService] Found {Count} investment(s) due for payout", investments.Count);

        var processedCount = 0;
        foreach (var investment in investments)
        {
            try
            {
                await ProcessSinglePayoutAsync(investment, cancellationToken);
                processedCount++;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[PayoutService] Failed to process payout for investment {Id}", investment.Id);
            }
        }

        _logger.LogWarning("[PayoutService] Processed {Count}/{Total} payouts", processedCount, investments.Count);
        return processedCount;
    }

    private async Task ProcessSinglePayoutAsync(Investment investment, CancellationToken cancellationToken)
    {
        var payout = investment.Amount * investment.DailyRate;
        const decimal referralBonusRate = 0.10m;

        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
        using var transaction = connection.BeginTransaction();

        try
        {
            // Get referrer
            var referrerId = await connection.QuerySingleOrDefaultAsync<Guid?>(
                "SELECT referrer_id FROM users WHERE id = @UserId",
                new { UserId = investment.UserId }, transaction);

            // Add payout to balance
            await connection.ExecuteAsync(
                "UPDATE users SET balance = balance + @Amount WHERE id = @UserId",
                new { Amount = payout, UserId = investment.UserId }, transaction);

            // Log profit transaction
            var profitTx = Transaction.Create(investment.UserId, payout, Transaction.Types.Profit,
                $"Daily profit from investment ({investment.DailyRate * 100:F1}%)");
            await _transactionRepository.AddAsync(profitTx, connection, transaction);

            // Notification
            var notif = Notification.Create(investment.UserId,
                $"💰 Вам начислена прибыль ${payout:F2} (ставка {investment.DailyRate * 100:F1}%)");
            await _notificationRepository.AddAsync(notif, connection, transaction);

            // Referral bonus
            if (referrerId.HasValue)
            {
                var bonus = payout * referralBonusRate;
                var affected = await connection.ExecuteAsync(
                    "UPDATE users SET balance = balance + @Amount WHERE id = @UserId",
                    new { Amount = bonus, UserId = referrerId.Value }, transaction);
                if (affected > 0)
                {
                    var refTx = Transaction.Create(referrerId.Value, bonus, Transaction.Types.ReferralBonus,
                        $"10% referral bonus from user {investment.UserId}");
                    await _transactionRepository.AddAsync(refTx, connection, transaction);
                    var refNotif = Notification.Create(referrerId.Value,
                        $"🎁 Реферальный бонус ${bonus:F2} от вашего реферала");
                    await _notificationRepository.AddAsync(refNotif, connection, transaction);
                }
            }

            // Update next payout
            var nextPayout = investment.NextPayoutAt.AddMinutes(2); // Demo mode: 2 min; Production: AddDays(1)
            await _investmentRepository.UpdateNextPayoutAsync(investment.Id, nextPayout, connection, transaction);

            transaction.Commit();
            _logger.LogWarning("[PayoutService] +${Payout:F2} to user {UserId}", payout, investment.UserId);
        }
        catch
        {
            transaction.Rollback();
            throw;
        }
    }
}
