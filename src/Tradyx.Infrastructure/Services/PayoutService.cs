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
    private readonly IRealtimeNotifier _realtime;
    private readonly ILogger<PayoutService> _logger;

    public PayoutService(
        IDbConnectionFactory connectionFactory,
        InvestmentRepository investmentRepository,
        TransactionRepository transactionRepository,
        NotificationRepository notificationRepository,
        IRealtimeNotifier realtime,
        ILogger<PayoutService> logger)
    {
        _connectionFactory = connectionFactory;
        _investmentRepository = investmentRepository;
        _transactionRepository = transactionRepository;
        _notificationRepository = notificationRepository;
        _realtime = realtime;
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
            var notifMsg = $"💰 Вам начислена прибыль ${payout:F2} (ставка {investment.DailyRate * 100:F1}%)";
            var notif = Notification.Create(investment.UserId, notifMsg);
            await _notificationRepository.AddAsync(notif, connection, transaction);

            // Referral bonus
            Guid? bonusRecipient = null;
            decimal bonusAmount = 0;
            if (referrerId.HasValue)
            {
                bonusAmount = payout * referralBonusRate;
                var affected = await connection.ExecuteAsync(
                    "UPDATE users SET balance = balance + @Amount WHERE id = @UserId",
                    new { Amount = bonusAmount, UserId = referrerId.Value }, transaction);
                if (affected > 0)
                {
                    bonusRecipient = referrerId.Value;
                    var refTx = Transaction.Create(referrerId.Value, bonusAmount, Transaction.Types.ReferralBonus,
                        $"10% referral bonus from user {investment.UserId}");
                    await _transactionRepository.AddAsync(refTx, connection, transaction);
                    var refNotif = Notification.Create(referrerId.Value,
                        $"🎁 Реферальный бонус ${bonusAmount:F2} от вашего реферала");
                    await _notificationRepository.AddAsync(refNotif, connection, transaction);
                }
            }

            // Update next payout
            var nextPayout = investment.NextPayoutAt.AddMinutes(2); // Demo mode: 2 min; Production: AddDays(1)
            await _investmentRepository.UpdateNextPayoutAsync(investment.Id, nextPayout, connection, transaction);

            transaction.Commit();
            _logger.LogWarning("[PayoutService] +${Payout:F2} to user {UserId}", payout, investment.UserId);

            // === Real-time notifications (fire-and-forget, after commit) ===
            _ = PushRealtimeEvents(investment.UserId, payout, notifMsg, bonusRecipient, bonusAmount);
        }
        catch
        {
            transaction.Rollback();
            throw;
        }
    }

    private async Task PushRealtimeEvents(
        Guid userId, decimal payout, string notifMsg,
        Guid? bonusRecipient, decimal bonusAmount)
    {
        try
        {
            // Get new balance via fresh connection
            using var conn = await _connectionFactory.CreateConnectionAsync();

            var newBalance = await conn.QuerySingleAsync<decimal>(
                "SELECT balance FROM users WHERE id = @UserId", new { UserId = userId });

            await _realtime.NotifyBalanceUpdated(userId, newBalance);
            await _realtime.NotifyPayoutReceived(userId, payout, $"Daily profit +${payout:F2}");
            await _realtime.NotifyTransactionCreated(userId, "Profit", payout);
            await _realtime.NotifyNewNotification(userId, notifMsg);

            // Notify referrer if they got a bonus
            if (bonusRecipient.HasValue && bonusAmount > 0)
            {
                var refBalance = await conn.QuerySingleAsync<decimal>(
                    "SELECT balance FROM users WHERE id = @UserId", new { UserId = bonusRecipient.Value });

                await _realtime.NotifyBalanceUpdated(bonusRecipient.Value, refBalance);
                await _realtime.NotifyPayoutReceived(bonusRecipient.Value, bonusAmount, "Referral bonus");
                await _realtime.NotifyTransactionCreated(bonusRecipient.Value, "ReferralBonus", bonusAmount);
                await _realtime.NotifyNewNotification(bonusRecipient.Value, $"🎁 Referral bonus +${bonusAmount:F2}");
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[PayoutService] SignalR notification failed for user {UserId} (non-critical)", userId);
        }
    }
}
