using System.Data;
using Tradyx.Core.Entities;

namespace Tradyx.Core.Interfaces;

public interface IRankService
{
    /// <summary>
    /// Check if the user qualifies for a rank upgrade.
    /// Call after investments, referral bonuses, etc.
    /// If upgraded, logs to rank_history, sends notification, pushes SignalR.
    /// </summary>
    Task CheckAndUpgradeStatusAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Increment personal turnover for a user and all ancestor team turnovers.
    /// Call after a new investment is created.
    /// </summary>
    Task UpdateTurnoversAsync(Guid userId, decimal investmentAmount,
        IDbConnection connection, IDbTransaction transaction);

    /// <summary>Get referral bonus rate multiplier based on user's rank.</summary>
    (decimal L1Mult, decimal L2Mult, decimal L3Mult) GetBonusMultipliers(UserRank rank);

    /// <summary>Get cashback rate for a rank (0 for Bronze/Silver).</summary>
    decimal GetCashbackRate(UserRank rank);

    /// <summary>Get rank progress info for dashboard.</summary>
    Task<RankProgressInfo> GetRankProgressAsync(Guid userId, CancellationToken cancellationToken = default);
}

public record RankProgressInfo
{
    public int CurrentRank { get; init; }
    public string CurrentRankName { get; init; } = "Bronze";
    public int? NextRank { get; init; }
    public string? NextRankName { get; init; }
    public decimal PersonalTurnover { get; init; }
    public decimal TeamTurnover { get; init; }
    /// <summary>How much more personal invest needed for next rank (null if max).</summary>
    public decimal? PersonalNeeded { get; init; }
    /// <summary>How much more team turnover needed for next rank (null if max).</summary>
    public decimal? TeamNeeded { get; init; }
    /// <summary>Progress towards next rank 0.0-1.0 (null if max).</summary>
    public decimal? Progress { get; init; }
    public decimal CashbackRate { get; init; }
}
