namespace Tradyx.Core.Interfaces;

/// <summary>
/// Centralized treasury management: health monitoring, insurance fund,
/// dynamic rate adjustments, and daily withdrawal limits.
/// </summary>
public interface ITreasuryService
{
    /// <summary>Get full treasury health snapshot (for admin + internal use).</summary>
    Task<TreasuryHealth> GetHealthAsync(CancellationToken cancellationToken = default);

    /// <summary>Get the rate multiplier for new investments based on treasury health (1.0 = normal, 0.7 = reduced).</summary>
    Task<decimal> GetRateMultiplierAsync(CancellationToken cancellationToken = default);

    /// <summary>Deduct insurance fee from a deposit and record it. Returns net amount (deposit - fee).</summary>
    Task<(decimal NetAmount, decimal InsuranceFee)> ProcessDepositInsuranceAsync(
        Guid userId, decimal grossAmount, System.Data.IDbConnection conn, System.Data.IDbTransaction tx);

    /// <summary>Check if a withdrawal can proceed under daily platform limits. Returns remaining daily capacity.</summary>
    Task<DailyLimitCheck> CheckDailyWithdrawalLimitAsync(
        Guid userId, decimal amount, CancellationToken cancellationToken = default);

    /// <summary>Get personal withdrawal limit based on rank.</summary>
    decimal GetPersonalDailyLimit(int userRank);

    /// <summary>Get cooling period remaining (hours) after last deposit. 0 = no restriction.</summary>
    Task<CoolingPeriodCheck> CheckCoolingPeriodAsync(Guid userId, CancellationToken cancellationToken = default);
}

public record TreasuryHealth
{
    /// <summary>Total deposits ever received.</summary>
    public decimal TotalDeposits { get; init; }

    /// <summary>Total payouts (profit + referral + cashback + withdrawals completed).</summary>
    public decimal TotalPayouts { get; init; }

    /// <summary>Current system reserve (deposits - payouts).</summary>
    public decimal Reserve { get; init; }

    /// <summary>Total active investments amount.</summary>
    public decimal ActiveInvestments { get; init; }

    /// <summary>Insurance fund balance.</summary>
    public decimal InsuranceFund { get; init; }

    /// <summary>Health ratio: reserve / active investments (>0.5 = green, 0.25-0.5 = yellow, <0.25 = red).</summary>
    public decimal HealthRatio { get; init; }

    /// <summary>"green", "yellow", or "red".</summary>
    public string Zone { get; init; } = "green";

    /// <summary>Current rate multiplier (1.0 = normal).</summary>
    public decimal RateMultiplier { get; init; } = 1.0m;

    /// <summary>Total withdrawn today (platform-wide).</summary>
    public decimal WithdrawnToday { get; init; }

    /// <summary>Daily withdrawal limit for the platform.</summary>
    public decimal DailyWithdrawalLimit { get; init; }

    /// <summary>Estimated days the reserve can sustain payouts without new deposits.</summary>
    public int EstimatedRunwayDays { get; init; }
}

public record DailyLimitCheck(
    bool Allowed,
    string? Error,
    decimal PlatformUsedToday,
    decimal PlatformLimit,
    decimal PersonalUsedToday,
    decimal PersonalLimit);

public record CoolingPeriodCheck(
    bool Allowed,
    string? Error,
    int HoursRemaining,
    DateTime? UnlocksAt);
