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
        >= 150m => 0.017m,
        >= 100m => 0.014m,
        >= 50m  => 0.011m,
        >= 20m  => 0.008m,
        _       => 0m
    };

    /// <summary>Default payout count per plan tier.</summary>
    public static int GetDefaultPayoutCount(decimal amount) => amount switch
    {
        >= 150m => 30,
        >= 100m => 30,
        >= 50m  => 30,
        >= 20m  => 30,
        _       => 0
    };
}
