using System.Data;
using Dapper;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Tradyx.Core.Entities;
using Tradyx.Core.Interfaces;

namespace Tradyx.Infrastructure.Services;

public class ReferralService : IReferralService
{
    private readonly IDbConnectionFactory _connectionFactory;
    private readonly IRankService _rankService;
    private readonly ILogger<ReferralService> _logger;

    // Base rates from config
    private readonly decimal _level1Rate;
    private readonly decimal _level2Rate;
    private readonly decimal _level3Rate;

    public ReferralService(
        IDbConnectionFactory connectionFactory,
        IRankService rankService,
        IConfiguration configuration,
        ILogger<ReferralService> logger)
    {
        _connectionFactory = connectionFactory;
        _rankService = rankService;
        _logger = logger;

        var section = configuration.GetSection("ReferralSettings");
        _level1Rate = decimal.TryParse(section["Level1Rate"], out var l1) ? l1 : 0.10m;
        _level2Rate = decimal.TryParse(section["Level2Rate"], out var l2) ? l2 : 0.05m;
        _level3Rate = decimal.TryParse(section["Level3Rate"], out var l3) ? l3 : 0.02m;

        _logger.LogInformation("[Referral] Base rates: L1={L1}%, L2={L2}%, L3={L3}%",
            _level1Rate * 100, _level2Rate * 100, _level3Rate * 100);
    }

    public async Task<List<ReferralBonusResult>> ProcessReferralBonusAsync(
        Guid sourceUserId, decimal payoutAmount,
        IDbConnection connection, IDbTransaction transaction)
    {
        var results = new List<ReferralBonusResult>();

        var user = await connection.QuerySingleOrDefaultAsync<(Guid? ReferrerId, string? ReferralPath)>(
            "SELECT referrer_id, referral_path FROM users WHERE id = @Id",
            new { Id = sourceUserId }, transaction);

        if (!user.ReferrerId.HasValue) return results;

        var ancestors = ResolveAncestors(user.ReferrerId.Value, user.ReferralPath);
        var baseRates = new[] { _level1Rate, _level2Rate, _level3Rate };

        for (var i = 0; i < ancestors.Count && i < 3; i++)
        {
            var ancestorId = ancestors[i];
            var level = i + 1;

            if (ancestorId == sourceUserId) continue;

            // Get the ancestor's rank to apply dynamic multiplier
            var ancestorStatus = await connection.QuerySingleOrDefaultAsync<int?>(
                "SELECT status FROM users WHERE id = @Id", new { Id = ancestorId }, transaction);
            if (ancestorStatus == null) continue;

            var rank = (UserRank)ancestorStatus.Value;
            var (l1Mult, l2Mult, l3Mult) = _rankService.GetBonusMultipliers(rank);
            var multipliers = new[] { l1Mult, l2Mult, l3Mult };

            var effectiveRate = Math.Round(baseRates[i] * multipliers[i], 4);
            var bonus = Math.Round(payoutAmount * effectiveRate, 2);

            if (bonus <= 0) continue;

            // Credit balance
            var affected = await connection.ExecuteAsync(
                "UPDATE users SET balance = balance + @Amount WHERE id = @UserId",
                new { Amount = bonus, UserId = ancestorId }, transaction);
            if (affected == 0) continue;

            // Log to transactions
            var tx = Transaction.Create(ancestorId, bonus, Transaction.Types.ReferralBonus,
                $"L{level} referral bonus ({effectiveRate * 100:F1}%) from payout ${payoutAmount:F2}");
            await connection.ExecuteAsync(@"
                INSERT INTO transactions (id, user_id, amount, type, description, created_at)
                VALUES (@Id, @UserId, @Amount, @Type, @Description, @CreatedAt)",
                new { tx.Id, tx.UserId, tx.Amount, tx.Type, tx.Description, tx.CreatedAt }, transaction);

            // Log to referral_transactions
            var refTx = ReferralTransaction.Create(ancestorId, sourceUserId, level, bonus, effectiveRate, payoutAmount);
            await connection.ExecuteAsync(@"
                INSERT INTO referral_transactions (id, recipient_id, source_user_id, level, amount, rate, source_amount, created_at)
                VALUES (@Id, @RecipientId, @SourceUserId, @Level, @Amount, @Rate, @SourceAmount, @CreatedAt)",
                new { refTx.Id, refTx.RecipientId, refTx.SourceUserId, refTx.Level, refTx.Amount, refTx.Rate, refTx.SourceAmount, refTx.CreatedAt },
                transaction);

            // Notification with rank info
            var rankLabel = rank > UserRank.Bronze ? $" [{rank}]" : "";
            var notif = Notification.Create(ancestorId,
                $"🎁 L{level} бонус{rankLabel}: +${bonus:F2} ({effectiveRate * 100:F1}%) от реферала {level}-го уровня");
            await connection.ExecuteAsync(@"
                INSERT INTO notifications (id, user_id, message, is_read, created_at)
                VALUES (@Id, @UserId, @Message, @IsRead, @CreatedAt)",
                new { notif.Id, notif.UserId, notif.Message, notif.IsRead, notif.CreatedAt }, transaction);

            results.Add(new ReferralBonusResult(ancestorId, level, bonus, effectiveRate));

            _logger.LogInformation("[Referral] L{Level} bonus +${Bonus:F2} ({Rate}% × {Rank}) to {RecipientId}",
                level, bonus, baseRates[i] * 100, rank, ancestorId);
        }

        return results;
    }

    public async Task<ReferralTeamResponse> GetMyTeamAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);

        const string sql = @"
            WITH RECURSIVE team AS (
                SELECT id, username, created_at, 1 AS level
                FROM users WHERE referrer_id = @MyId
                UNION ALL
                SELECT u.id, u.username, u.created_at, t.level + 1
                FROM users u JOIN team t ON u.referrer_id = t.id
                WHERE t.level < 3
            )
            SELECT t.id, t.username, t.created_at AS joined_at, t.level,
                   COALESCE(SUM(rt.amount), 0) AS total_earned
            FROM team t
            LEFT JOIN referral_transactions rt ON rt.recipient_id = @MyId AND rt.source_user_id = t.id
            GROUP BY t.id, t.username, t.created_at, t.level
            ORDER BY t.level, t.created_at DESC";

        var members = (await connection.QueryAsync<ReferralMember>(sql, new { MyId = userId })).ToList();

        const string statsSql = @"
            SELECT COALESCE(SUM(amount), 0) AS total_earned,
                   COALESCE(SUM(CASE WHEN created_at >= CURRENT_DATE THEN amount ELSE 0 END), 0) AS today_earned
            FROM referral_transactions WHERE recipient_id = @MyId";

        var earnings = await connection.QuerySingleAsync<(decimal TotalEarned, decimal TodayEarned)>(
            statsSql, new { MyId = userId });

        var l1 = members.Where(m => m.Level == 1).ToList();
        var l2 = members.Where(m => m.Level == 2).ToList();
        var l3 = members.Where(m => m.Level == 3).ToList();

        return new ReferralTeamResponse
        {
            Level1 = l1, Level2 = l2, Level3 = l3,
            Stats = new ReferralTeamStats
            {
                TotalMembers = members.Count,
                Level1Count = l1.Count, Level2Count = l2.Count, Level3Count = l3.Count,
                TotalEarned = earnings.TotalEarned, TodayEarned = earnings.TodayEarned
            }
        };
    }

    private static List<Guid> ResolveAncestors(Guid directParentId, string? referralPath)
    {
        var ancestors = new List<Guid> { directParentId };
        if (string.IsNullOrEmpty(referralPath)) return ancestors;

        var segments = referralPath.Split('/', StringSplitOptions.RemoveEmptyEntries);
        for (var i = segments.Length - 1; i >= 0 && ancestors.Count < 3; i--)
        {
            if (Guid.TryParse(segments[i], out var ancestorId) && ancestorId != directParentId)
                ancestors.Add(ancestorId);
        }
        return ancestors;
    }
}
