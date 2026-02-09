namespace Tradyx.Core.Entities;

public class Investment
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public decimal Amount { get; set; }
    public decimal DailyRate { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime NextPayoutAt { get; set; }
    public bool IsActive { get; set; }

    /// <summary>Number of payouts remaining before this investment expires.</summary>
    public int RemainingPayouts { get; set; }

    public static decimal GetDailyRate(decimal amount) => amount switch
    {
        >= 2000m => 0.0085m,   // Elite
        >= 500m  => 0.0075m,   // Premium
        >= 100m  => 0.0065m,   // Growth
        >= 20m   => 0.005m,    // Starter
        _        => 0m
    };

    /// <summary>Default payout count per plan tier.</summary>
    public static int GetDefaultPayoutCount(decimal amount) => amount switch
    {
        >= 2000m => 120,  // Elite
        >= 500m  => 90,   // Premium
        >= 100m  => 60,   // Growth
        >= 20m   => 45,   // Starter
        _        => 0
    };
}
