namespace Tradyx.Core.Entities;

/// <summary>
/// Logs every referral bonus payout: who earned, from whose activity, at what level, how much.
/// </summary>
public class ReferralTransaction
{
    public Guid Id { get; set; }

    /// <summary>The user who received the referral bonus.</summary>
    public Guid RecipientId { get; set; }

    /// <summary>The user whose activity (payout) triggered this bonus.</summary>
    public Guid SourceUserId { get; set; }

    /// <summary>Referral level: 1, 2, or 3.</summary>
    public int Level { get; set; }

    /// <summary>Bonus amount in USD.</summary>
    public decimal Amount { get; set; }

    /// <summary>The rate that was applied (e.g. 0.10 for 10%).</summary>
    public decimal Rate { get; set; }

    /// <summary>The original payout amount that the bonus was calculated from.</summary>
    public decimal SourceAmount { get; set; }

    public DateTime CreatedAt { get; set; }

    public static ReferralTransaction Create(
        Guid recipientId, Guid sourceUserId, int level,
        decimal amount, decimal rate, decimal sourceAmount)
    {
        return new ReferralTransaction
        {
            Id = Guid.NewGuid(),
            RecipientId = recipientId,
            SourceUserId = sourceUserId,
            Level = level,
            Amount = amount,
            Rate = rate,
            SourceAmount = sourceAmount,
            CreatedAt = DateTime.UtcNow
        };
    }
}
