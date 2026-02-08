namespace Tradyx.Core.Entities;

public class Transaction
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public decimal Amount { get; set; }
    public string Type { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Status { get; set; } = Statuses.Completed;
    public decimal FeeAmount { get; set; }
    public bool IsInstant { get; set; }
    public string? WalletAddress { get; set; }
    public DateTime CreatedAt { get; set; }

    public static class Types
    {
        public const string Deposit = "Deposit";
        public const string Withdrawal = "Withdrawal";
        public const string Investment = "Investment";
        public const string Profit = "Profit";
        public const string ReferralBonus = "ReferralBonus";
        public const string ManualAdjustment = "ManualAdjustment";
        public const string Cashback = "Cashback";
    }

    public static class Statuses
    {
        public const string Pending = "Pending";
        public const string Approved = "Approved";
        public const string Rejected = "Rejected";
        public const string Completed = "Completed";
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
            Status = Statuses.Completed,
            CreatedAt = DateTime.UtcNow
        };
    }

    public static Transaction CreateWithdrawal(
        Guid userId, decimal amount, decimal fee, bool isInstant,
        string? walletAddress, string status, string description)
    {
        return new Transaction
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Amount = -amount,          // negative = outflow
            Type = Types.Withdrawal,
            Description = description,
            Status = status,
            FeeAmount = fee,
            IsInstant = isInstant,
            WalletAddress = walletAddress,
            CreatedAt = DateTime.UtcNow
        };
    }
}
