namespace Tradyx.Core.Entities;

public class Transaction
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public decimal Amount { get; set; }
    public string Type { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }

    public static class Types
    {
        public const string Deposit = "Deposit";
        public const string Withdrawal = "Withdrawal";
        public const string Investment = "Investment";
        public const string Profit = "Profit";
        public const string ReferralBonus = "ReferralBonus";
        public const string ManualAdjustment = "ManualAdjustment";
    }

    public static Transaction Create(Guid userId, decimal amount, string type, string description)
    {
        return new Transaction
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Amount = amount,
            Type = type,
            Description = description,
            CreatedAt = DateTime.UtcNow
        };
    }
}
