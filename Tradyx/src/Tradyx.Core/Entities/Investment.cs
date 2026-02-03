namespace Tradyx.Core.Entities;

/// <summary>
/// Represents an investment in the Tradyx platform.
/// </summary>
public class Investment
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public decimal Amount { get; set; }
    public decimal DailyRate { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime NextPayoutAt { get; set; }
    public bool IsActive { get; set; }

    /// <summary>
    /// Creates a new investment with calculated daily rate.
    /// </summary>
    public static Investment Create(Guid userId, decimal amount)
    {
        if (amount < 20)
            throw new ArgumentException("Minimum investment amount is $20.", nameof(amount));

        return new Investment
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Amount = amount,
            DailyRate = CalculateDailyRate(amount),
            CreatedAt = DateTime.UtcNow,
            NextPayoutAt = DateTime.UtcNow.AddDays(1),
            IsActive = true
        };
    }

    /// <summary>
    /// Calculates daily rate based on investment amount.
    /// </summary>
    public static decimal CalculateDailyRate(decimal amount) => amount switch
    {
        >= 150 => 0.017m,  // 1.7%
        >= 100 => 0.014m,  // 1.4%
        >= 50 => 0.011m,   // 1.1%
        >= 20 => 0.008m,   // 0.8%
        _ => throw new ArgumentException("Minimum investment amount is $20.", nameof(amount))
    };

    /// <summary>
    /// Calculates the daily payout amount.
    /// </summary>
    public decimal GetDailyPayout() => Amount * DailyRate;
}
