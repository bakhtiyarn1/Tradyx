using System.Data;
using Tradyx.Core.Entities;

namespace Tradyx.Core.Interfaces;

/// <summary>
/// Multi-level referral bonus system.
/// Processes 3-level bonuses and provides team overview.
/// </summary>
public interface IReferralService
{
    /// <summary>
    /// Distribute referral bonuses up to 3 levels for a payout event.
    /// Must be called within an existing DB transaction for atomicity.
    /// </summary>
    /// <param name="sourceUserId">The user whose payout triggered the bonus.</param>
    /// <param name="payoutAmount">The payout amount bonuses are calculated from.</param>
    /// <param name="connection">Open DB connection (shared with caller's transaction).</param>
    /// <param name="transaction">Active DB transaction for atomicity.</param>
    /// <returns>List of bonuses distributed (for SignalR notifications).</returns>
    Task<List<ReferralBonusResult>> ProcessReferralBonusAsync(
        Guid sourceUserId, decimal payoutAmount,
        IDbConnection connection, IDbTransaction transaction);

    /// <summary>Get the user's referral team grouped by level (1-3).</summary>
    Task<ReferralTeamResponse> GetMyTeamAsync(Guid userId, CancellationToken cancellationToken = default);
}

/// <summary>Result of a single referral bonus distribution.</summary>
public record ReferralBonusResult(
    Guid RecipientId, int Level, decimal Amount, decimal Rate);

/// <summary>Response for "My Team" endpoint.</summary>
public record ReferralTeamResponse
{
    public List<ReferralMember> Level1 { get; init; } = new();
    public List<ReferralMember> Level2 { get; init; } = new();
    public List<ReferralMember> Level3 { get; init; } = new();
    public ReferralTeamStats Stats { get; init; } = new();
}

public record ReferralMember
{
    public Guid Id { get; init; }
    public string Username { get; init; } = string.Empty;
    public DateTime JoinedAt { get; init; }
    public int Level { get; init; }
    /// <summary>Total referral earnings this member has generated for you.</summary>
    public decimal TotalEarned { get; init; }
}

public record ReferralTeamStats
{
    public int TotalMembers { get; init; }
    public int Level1Count { get; init; }
    public int Level2Count { get; init; }
    public int Level3Count { get; init; }
    public decimal TotalEarned { get; init; }
    public decimal TodayEarned { get; init; }
}
