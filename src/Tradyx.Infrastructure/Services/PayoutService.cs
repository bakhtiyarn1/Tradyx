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
    private readonly IReferralService _referralService;
    private readonly IRankService _rankService;
    private readonly IRealtimeNotifier _realtime;
    private readonly ILogger<PayoutService> _logger;

    public PayoutService(
        IDbConnectionFactory connectionFactory,
        InvestmentRepository investmentRepository,
        TransactionRepository transactionRepository,
        NotificationRepository notificationRepository,
        IReferralService referralService,
        IRankService rankService,
        IRealtimeNotifier realtime,
        ILogger<PayoutService> logger)
    {
        _connectionFactory = connectionFactory;
        _investmentRepository = investmentRepository;
        _transactionRepository = transactionRepository;
        _notificationRepository = notificationRepository;
        _referralService = referralService;
        _rankService = rankService;
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

        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
        using var transaction = connection.BeginTransaction();

        List<ReferralBonusResult> referralResults;
        var notifMsg = $"💰 Вам начислена прибыль ${payout:F2} (ставка {investment.DailyRate * 100:F1}%)";

        try
        {
            // 1. Add payout to user's balance
            await connection.ExecuteAsync(
                "UPDATE users SET balance = balance + @Amount WHERE id = @UserId",
                new { Amount = payout, UserId = investment.UserId }, transaction);

            // 2. Log profit transaction
            var profitTx = Transaction.Create(investment.UserId, payout, Transaction.Types.Profit,
                $"Daily profit from investment ({investment.DailyRate * 100:F1}%)");
            await _transactionRepository.AddAsync(profitTx, connection, transaction);

            // 3. Notification for the investor
            var notif = Notification.Create(investment.UserId, notifMsg);
            await _notificationRepository.AddAsync(notif, connection, transaction);

            // 4. 3-LEVEL REFERRAL BONUSES (with dynamic rates)
            referralResults = await _referralService.ProcessReferralBonusAsync(
                investment.UserId, payout, connection, transaction);

            // 5. Update next payout time
            var nextPayout = investment.NextPayoutAt.AddMinutes(2);
            await _investmentRepository.UpdateNextPayoutAsync(investment.Id, nextPayout, connection, transaction);

            transaction.Commit();
            _logger.LogWarning("[PayoutService] +${Payout:F2} to user {UserId}, {RefCount} referral bonus(es)",
                payout, investment.UserId, referralResults.Count);
        }
        catch
        {
            transaction.Rollback();
            throw;
        }

        // Fire-and-forget: Real-time notifications + rank checks
        _ = PushRealtimeEventsAndCheckRanks(investment.UserId, payout, notifMsg, referralResults);
    }

    private async Task PushRealtimeEventsAndCheckRanks(
        Guid userId, decimal payout, string notifMsg,
        List<ReferralBonusResult> referralResults)
    {
        try
        {
            using var conn = await _connectionFactory.CreateConnectionAsync();

            var newBalance = await conn.QuerySingleAsync<decimal>(
                "SELECT balance FROM users WHERE id = @UserId", new { UserId = userId });

            await _realtime.NotifyBalanceUpdated(userId, newBalance);
            await _realtime.NotifyPayoutReceived(userId, payout, $"Daily profit +${payout:F2}");
            await _realtime.NotifyTransactionCreated(userId, "Profit", payout);
            await _realtime.NotifyNewNotification(userId, notifMsg);

            foreach (var bonus in referralResults)
            {
                try
                {
                    var refBalance = await conn.QuerySingleAsync<decimal>(
                        "SELECT balance FROM users WHERE id = @UserId", new { UserId = bonus.RecipientId });
                    await _realtime.NotifyBalanceUpdated(bonus.RecipientId, refBalance);
                    await _realtime.NotifyPayoutReceived(bonus.RecipientId, bonus.Amount,
                        $"L{bonus.Level} referral bonus ({bonus.Rate * 100:F0}%)");
                    await _realtime.NotifyTransactionCreated(bonus.RecipientId, "ReferralBonus", bonus.Amount);
                    await _realtime.NotifyNewNotification(bonus.RecipientId,
                        $"🎁 L{bonus.Level} бонус +${bonus.Amount:F2} ({bonus.Rate * 100:F0}%)");

                    // Check rank for each bonus recipient too
                    await _rankService.CheckAndUpgradeStatusAsync(bonus.RecipientId);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "[PayoutService] SignalR/Rank failed for referral recipient {RecipientId}",
                        bonus.RecipientId);
                }
            }

            // Check rank for the investor
            await _rankService.CheckAndUpgradeStatusAsync(userId);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[PayoutService] Post-payout notification failed for user {UserId}", userId);
        }
    }
}
