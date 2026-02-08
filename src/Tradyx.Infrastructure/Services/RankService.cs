using System.Data;
using System.Globalization;
using Dapper;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Tradyx.Core.Entities;
using Tradyx.Core.Interfaces;

namespace Tradyx.Infrastructure.Services;

public class RankService : IRankService
{
    private readonly IDbConnectionFactory _connectionFactory;
    private readonly IRealtimeNotifier _realtime;
    private readonly ILogger<RankService> _logger;

    // Thresholds from config
    private readonly decimal _silverPersonal, _silverTeam;
    private readonly decimal _goldPersonal, _goldTeam;
    private readonly decimal _platinumPersonal, _platinumTeam;

    // Bonus multipliers per rank: [L1mult, L2mult, L3mult, CashbackRate]
    private readonly Dictionary<UserRank, (decimal L1, decimal L2, decimal L3, decimal Cashback)> _multipliers;

    private static readonly string[] RankNames = { "Bronze", "Silver", "Gold", "Platinum" };

    public RankService(
        IDbConnectionFactory connectionFactory,
        IRealtimeNotifier realtime,
        IConfiguration configuration,
        ILogger<RankService> logger)
    {
        _connectionFactory = connectionFactory;
        _realtime = realtime;
        _logger = logger;

        var r = configuration.GetSection("RankSettings");

        _silverPersonal = ParseDec(r["Silver:PersonalInvest"], 500);
        _silverTeam     = ParseDec(r["Silver:TeamTurnover"], 2000);
        _goldPersonal   = ParseDec(r["Gold:PersonalInvest"], 2000);
        _goldTeam       = ParseDec(r["Gold:TeamTurnover"], 10000);
        _platinumPersonal = ParseDec(r["Platinum:PersonalInvest"], 5000);
        _platinumTeam     = ParseDec(r["Platinum:TeamTurnover"], 50000);

        _multipliers = new()
        {
            [UserRank.Bronze]   = (ParseDec(r["BonusMultipliers:Bronze:L1"], 1.0m),
                                   ParseDec(r["BonusMultipliers:Bronze:L2"], 1.0m),
                                   ParseDec(r["BonusMultipliers:Bronze:L3"], 1.0m),
                                   ParseDec(r["BonusMultipliers:Bronze:Cashback"], 0m)),
            [UserRank.Silver]   = (ParseDec(r["BonusMultipliers:Silver:L1"], 1.0m),
                                   ParseDec(r["BonusMultipliers:Silver:L2"], 1.0m),
                                   ParseDec(r["BonusMultipliers:Silver:L3"], 1.0m),
                                   ParseDec(r["BonusMultipliers:Silver:Cashback"], 0m)),
            [UserRank.Gold]     = (ParseDec(r["BonusMultipliers:Gold:L1"], 1.2m),
                                   ParseDec(r["BonusMultipliers:Gold:L2"], 1.4m),
                                   ParseDec(r["BonusMultipliers:Gold:L3"], 1.5m),
                                   ParseDec(r["BonusMultipliers:Gold:Cashback"], 0.01m)),
            [UserRank.Platinum] = (ParseDec(r["BonusMultipliers:Platinum:L1"], 1.5m),
                                   ParseDec(r["BonusMultipliers:Platinum:L2"], 1.6m),
                                   ParseDec(r["BonusMultipliers:Platinum:L3"], 2.0m),
                                   ParseDec(r["BonusMultipliers:Platinum:Cashback"], 0.02m)),
        };

        _logger.LogInformation("[Rank] Thresholds: Silver(${Sp}/{St}), Gold(${Gp}/{Gt}), Platinum(${Pp}/{Pt})",
            _silverPersonal, _silverTeam, _goldPersonal, _goldTeam, _platinumPersonal, _platinumTeam);
    }

    public async Task CheckAndUpgradeStatusAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        using var conn = await _connectionFactory.CreateConnectionAsync(cancellationToken);

        var user = await conn.QuerySingleOrDefaultAsync<(int Status, decimal PersonalTurnover, decimal TeamTurnover)>(
            "SELECT status, personal_turnover, team_turnover FROM users WHERE id = @Id",
            new { Id = userId });

        var currentRank = (UserRank)user.Status;
        var newRank = CalculateRank(user.PersonalTurnover, user.TeamTurnover);

        if (newRank <= currentRank) return; // no upgrade

        // Upgrade
        using var tx = conn.BeginTransaction();
        try
        {
            await conn.ExecuteAsync(
                "UPDATE users SET status = @NewStatus WHERE id = @Id",
                new { NewStatus = (int)newRank, Id = userId }, tx);

            // Log rank history
            var history = UserRankHistory.Create(userId, currentRank, newRank, user.PersonalTurnover, user.TeamTurnover);
            await conn.ExecuteAsync(@"
                INSERT INTO user_rank_history (id, user_id, old_rank, new_rank, personal_turnover, team_turnover, created_at)
                VALUES (@Id, @UserId, @OldRank, @NewRank, @PersonalTurnover, @TeamTurnover, @CreatedAt)",
                new { history.Id, history.UserId, history.OldRank, history.NewRank,
                      history.PersonalTurnover, history.TeamTurnover, history.CreatedAt }, tx);

            // Notification
            var notif = Notification.Create(userId,
                $"🏆 Поздравляем! Ваш статус повышен до {RankNames[(int)newRank]}! Теперь ваши бонусы выше.");
            await conn.ExecuteAsync(@"
                INSERT INTO notifications (id, user_id, message, is_read, created_at)
                VALUES (@Id, @UserId, @Message, @IsRead, @CreatedAt)",
                new { notif.Id, notif.UserId, notif.Message, notif.IsRead, notif.CreatedAt }, tx);

            tx.Commit();

            _logger.LogWarning("[Rank] User {UserId} upgraded: {Old} → {New}",
                userId, currentRank, newRank);

            // SignalR push (fire-and-forget)
            _ = Task.Run(async () =>
            {
                try
                {
                    await _realtime.NotifyStatusUpgraded(userId, (int)currentRank, (int)newRank, RankNames[(int)newRank]);
                    await _realtime.NotifyNewNotification(userId,
                        $"🏆 Status upgraded to {RankNames[(int)newRank]}!");
                }
                catch { /* non-critical */ }
            });
        }
        catch
        {
            tx.Rollback();
            throw;
        }
    }

    public async Task UpdateTurnoversAsync(Guid userId, decimal investmentAmount,
        IDbConnection connection, IDbTransaction transaction)
    {
        // 1. Increment personal turnover
        await connection.ExecuteAsync(
            "UPDATE users SET personal_turnover = personal_turnover + @Amount WHERE id = @UserId",
            new { Amount = investmentAmount, UserId = userId }, transaction);

        // 2. Get referral_path to find ancestors
        var info = await connection.QuerySingleOrDefaultAsync<(Guid? ReferrerId, string? ReferralPath)>(
            "SELECT referrer_id, referral_path FROM users WHERE id = @Id",
            new { Id = userId }, transaction);

        if (!info.ReferrerId.HasValue) return;

        // 3. Build ancestor list (up to 3 levels)
        var ancestors = new List<Guid> { info.ReferrerId.Value };
        if (!string.IsNullOrEmpty(info.ReferralPath))
        {
            var segments = info.ReferralPath.Split('/', StringSplitOptions.RemoveEmptyEntries);
            for (var i = segments.Length - 1; i >= 0 && ancestors.Count < 3; i--)
            {
                if (Guid.TryParse(segments[i], out var aid) && aid != info.ReferrerId.Value)
                    ancestors.Add(aid);
            }
        }

        // 4. Increment team_turnover for each ancestor
        if (ancestors.Count > 0)
        {
            await connection.ExecuteAsync(
                "UPDATE users SET team_turnover = team_turnover + @Amount WHERE id = ANY(@Ids)",
                new { Amount = investmentAmount, Ids = ancestors.ToArray() }, transaction);
        }
    }

    public (decimal L1Mult, decimal L2Mult, decimal L3Mult) GetBonusMultipliers(UserRank rank)
    {
        var m = _multipliers.GetValueOrDefault(rank, _multipliers[UserRank.Bronze]);
        return (m.L1, m.L2, m.L3);
    }

    public decimal GetCashbackRate(UserRank rank)
    {
        return _multipliers.GetValueOrDefault(rank, _multipliers[UserRank.Bronze]).Cashback;
    }

    public async Task<RankProgressInfo> GetRankProgressAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        using var conn = await _connectionFactory.CreateConnectionAsync(cancellationToken);

        var user = await conn.QuerySingleOrDefaultAsync<(int Status, decimal PersonalTurnover, decimal TeamTurnover)>(
            "SELECT status, personal_turnover, team_turnover FROM users WHERE id = @Id",
            new { Id = userId });

        var rank = (UserRank)user.Status;
        var cashback = GetCashbackRate(rank);

        // Next rank thresholds
        decimal? nextPersonal = null, nextTeam = null;
        int? nextRank = null;
        string? nextRankName = null;

        if (rank < UserRank.Platinum)
        {
            var nr = rank + 1;
            nextRank = (int)nr;
            nextRankName = RankNames[(int)nr];
            var (pThreshold, tThreshold) = GetThresholds(nr);
            nextPersonal = Math.Max(0, pThreshold - user.PersonalTurnover);
            nextTeam = Math.Max(0, tThreshold - user.TeamTurnover);
        }

        // Progress: best of personal or team progress towards next level
        decimal? progress = null;
        if (rank < UserRank.Platinum)
        {
            var nr = rank + 1;
            var (pT, tT) = GetThresholds(nr);
            var pProgress = pT > 0 ? Math.Min(1m, user.PersonalTurnover / pT) : 0;
            var tProgress = tT > 0 ? Math.Min(1m, user.TeamTurnover / tT) : 0;
            progress = Math.Max(pProgress, tProgress); // best path
        }

        return new RankProgressInfo
        {
            CurrentRank = user.Status,
            CurrentRankName = RankNames[user.Status],
            NextRank = nextRank,
            NextRankName = nextRankName,
            PersonalTurnover = user.PersonalTurnover,
            TeamTurnover = user.TeamTurnover,
            PersonalNeeded = nextPersonal,
            TeamNeeded = nextTeam,
            Progress = progress,
            CashbackRate = cashback
        };
    }

    private UserRank CalculateRank(decimal personal, decimal team)
    {
        if (personal >= _platinumPersonal || team >= _platinumTeam) return UserRank.Platinum;
        if (personal >= _goldPersonal || team >= _goldTeam) return UserRank.Gold;
        if (personal >= _silverPersonal || team >= _silverTeam) return UserRank.Silver;
        return UserRank.Bronze;
    }

    private (decimal Personal, decimal Team) GetThresholds(UserRank rank) => rank switch
    {
        UserRank.Silver => (_silverPersonal, _silverTeam),
        UserRank.Gold => (_goldPersonal, _goldTeam),
        UserRank.Platinum => (_platinumPersonal, _platinumTeam),
        _ => (0, 0)
    };

    private static decimal ParseDec(string? s, decimal fallback) =>
        decimal.TryParse(s, NumberStyles.Any, CultureInfo.InvariantCulture, out var v) ? v : fallback;
}
