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

    public static decimal GetDailyRate(decimal amount) => amount switch
    {
        >= 150m => 0.017m,
        >= 100m => 0.014m,
        >= 50m  => 0.011m,
        >= 20m  => 0.008m,
        _       => 0m
    };
}
