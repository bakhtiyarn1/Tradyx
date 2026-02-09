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
    private readonly ITelegramNotifier _telegram;
    private readonly ILogger<PayoutService> _logger;

    public PayoutService(
        IDbConnectionFactory connectionFactory,
        InvestmentRepository investmentRepository,
        TransactionRepository transactionRepository,
        NotificationRepository notificationRepository,
        IReferralService referralService,
        IRankService rankService,
        IRealtimeNotifier realtime,
        ITelegramNotifier telegram,
        ILogger<PayoutService> logger)
    {
        _connectionFactory = connectionFactory;
        _investmentRepository = investmentRepository;
        _transactionRepository = transactionRepository;
        _notificationRepository = notificationRepository;
        _referralService = referralService;
        _rankService = rankService;
        _realtime = realtime;
        _telegram = telegram;
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
        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
        using var transaction = connection.BeginTransaction();

        List<ReferralBonusResult> referralResults;

        try
        {
            // ====== S1 FIX: Lock the investment row with FOR UPDATE SKIP LOCKED ======
            // If another worker already locked this row, SKIP LOCKED returns null → we skip gracefully.
            const string lockSql = @"
                SELECT * FROM investments
                WHERE id = @Id AND is_active = true AND next_payout_at <= NOW() AND remaining_payouts > 0
                FOR UPDATE SKIP LOCKED";

            var locked = await connection.QuerySingleOrDefaultAsync<Investment>(
                lockSql, new { Id = investment.Id }, transaction);

            if (locked == null)
            {
                // Already processed by another worker, or no longer eligible
                transaction.Rollback();
                _logger.LogDebug("[PayoutService] Skipped investment {Id} (locked/ineligible)", investment.Id);
                return;
            }

            var payout = locked.Amount * locked.DailyRate;
            var notifMsg = $"💰 Вам начислена прибыль ${payout:F2} (ставка {locked.DailyRate * 100:F1}%)";
            var newRemaining = locked.RemainingPayouts - 1;
            var contractFinished = newRemaining <= 0;

            // 1. Add payout to user's balance
            await connection.ExecuteAsync(
                "UPDATE users SET balance = balance + @Amount WHERE id = @UserId",
                new { Amount = payout, UserId = locked.UserId }, transaction);

            // 2. Log profit transaction
            var profitTx = Transaction.Create(locked.UserId, payout, Transaction.Types.Profit,
                $"Daily profit from investment ({locked.DailyRate * 100:F1}%) — {newRemaining} payouts left");
            await _transactionRepository.AddAsync(profitTx, connection, transaction);

            // 3. Notification for the investor
            var notif = Notification.Create(locked.UserId, notifMsg);
            await _notificationRepository.AddAsync(notif, connection, transaction);

            // 4. 3-LEVEL REFERRAL BONUSES (with dynamic rates)
            referralResults = await _referralService.ProcessReferralBonusAsync(
                locked.UserId, payout, connection, transaction);

            // 5. Decrement remaining_payouts and update next payout (or deactivate)
            if (contractFinished)
            {
                // Contract is exhausted → deactivate
                await connection.ExecuteAsync(
                    "UPDATE investments SET remaining_payouts = 0, is_active = false WHERE id = @Id",
                    new { Id = locked.Id }, transaction);

                var finishNotif = Notification.Create(locked.UserId,
                    $"📄 Ваш инвестиционный контракт на ${locked.Amount:F2} завершён! Все {locked.RemainingPayouts} выплат получены.");
                await _notificationRepository.AddAsync(finishNotif, connection, transaction);
            }
            else
            {
                var nextPayout = locked.NextPayoutAt.AddMinutes(2);
                await connection.ExecuteAsync(
                    "UPDATE investments SET next_payout_at = @NextPayoutAt, remaining_payouts = @Remaining WHERE id = @Id",
                    new { NextPayoutAt = nextPayout, Remaining = newRemaining, Id = locked.Id }, transaction);
            }

            transaction.Commit();
            _logger.LogWarning("[PayoutService] +${Payout:F2} to user {UserId}, remaining={Remaining}, refs={RefCount}",
                payout, locked.UserId, newRemaining, referralResults.Count);

            // Fire-and-forget: Real-time notifications + rank checks
            _ = PushRealtimeEventsAndCheckRanks(locked.UserId, payout, notifMsg, referralResults, contractFinished, locked.Amount);
        }
        catch
        {
            transaction.Rollback();
            throw;
        }
    }

    private async Task PushRealtimeEventsAndCheckRanks(
        Guid userId, decimal payout, string notifMsg,
        List<ReferralBonusResult> referralResults,
        bool contractFinished = false, decimal contractAmount = 0)
    {
        try
        {
            using var conn = await _connectionFactory.CreateConnectionAsync();

            var user = await conn.QuerySingleOrDefaultAsync<(string Username, decimal Balance)>(
                "SELECT username, balance FROM users WHERE id = @UserId", new { UserId = userId });

            await _realtime.NotifyBalanceUpdated(userId, user.Balance);
            await _realtime.NotifyPayoutReceived(userId, payout, $"Daily profit +${payout:F2}");
            await _realtime.NotifyTransactionCreated(userId, "Profit", payout);
            await _realtime.NotifyNewNotification(userId, notifMsg);

            // Telegram: daily payout
            await _telegram.NotifyAsync(
                $"💰 <b>Выплата профита</b>\n\n" +
                $"👤 <code>{user.Username}</code>\n" +
                $"📈 Профит: <b>+${payout:F2}</b>\n" +
                $"💼 Баланс: <b>${user.Balance:F2}</b>");

            // Notify if the investment contract has finished
            if (contractFinished)
            {
                await _realtime.NotifyInvestmentUpdated(userId);
                await _realtime.NotifyNewNotification(userId,
                    $"📄 Ваш инвестиционный контракт на ${contractAmount:F2} завершён!");

                // Telegram: contract finished
                await _telegram.NotifyAsync(
                    $"📄 <b>Контракт завершён</b>\n\n" +
                    $"👤 <code>{user.Username}</code>\n" +
                    $"💵 Сумма контракта: <b>${contractAmount:F2}</b>\n" +
                    $"✅ Все выплаты получены");
            }

            foreach (var bonus in referralResults)
            {
                try
                {
                    var refUser = await conn.QuerySingleOrDefaultAsync<(string Username, decimal Balance)>(
                        "SELECT username, balance FROM users WHERE id = @UserId", new { UserId = bonus.RecipientId });
                    await _realtime.NotifyBalanceUpdated(bonus.RecipientId, refUser.Balance);
                    await _realtime.NotifyPayoutReceived(bonus.RecipientId, bonus.Amount,
                        $"L{bonus.Level} referral bonus ({bonus.Rate * 100:F0}%)");
                    await _realtime.NotifyTransactionCreated(bonus.RecipientId, "ReferralBonus", bonus.Amount);
                    await _realtime.NotifyNewNotification(bonus.RecipientId,
                        $"🎁 L{bonus.Level} бонус +${bonus.Amount:F2} ({bonus.Rate * 100:F0}%)");

                    // Telegram: referral bonus
                    await _telegram.NotifyAsync(
                        $"🎁 <b>Реферальный бонус</b>\n\n" +
                        $"👤 Получатель: <code>{refUser.Username}</code>\n" +
                        $"🔗 Уровень: L{bonus.Level}\n" +
                        $"💰 Бонус: <b>+${bonus.Amount:F2}</b> ({bonus.Rate * 100:F1}%)\n" +
                        $"💼 Баланс: <b>${refUser.Balance:F2}</b>");

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
