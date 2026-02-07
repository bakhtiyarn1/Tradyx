namespace Tradyx.Core.DTOs.Admin;

public record UserFullDetailsResponse
{
    public UserProfile Profile { get; init; } = null!;
    public List<TransactionDetail> Transactions { get; init; } = new();
    public List<InvestmentDetail> Investments { get; init; } = new();
    public List<NotificationDetail> Notifications { get; init; } = new();
    public ReferralInfo Referrals { get; init; } = new();
}

public record UserProfile
{
    public Guid Id { get; init; }
    public string Username { get; init; } = string.Empty;
    public string Email { get; init; } = string.Empty;
    public decimal Balance { get; init; }
    public Guid? ReferrerId { get; init; }
    public string? ReferrerUsername { get; init; }
    public DateTime CreatedAt { get; init; }
}

public record TransactionDetail
{
    public Guid Id { get; init; }
    public decimal Amount { get; init; }
    public string Type { get; init; } = string.Empty;
    public string Description { get; init; } = string.Empty;
    public DateTime CreatedAt { get; init; }
}

public record InvestmentDetail
{
    public Guid Id { get; init; }
    public decimal Amount { get; init; }
    public decimal DailyRate { get; init; }
    public decimal DailyPayout { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime NextPayoutAt { get; init; }
    public bool IsActive { get; init; }
}

public record NotificationDetail
{
    public Guid Id { get; init; }
    public string Message { get; init; } = string.Empty;
    public bool IsRead { get; init; }
    public DateTime CreatedAt { get; init; }
}

public record ReferralInfo
{
    public int TotalReferrals { get; init; }
    public List<ReferralUser> Referrals { get; init; } = new();
}

public record ReferralUser
{
    public Guid Id { get; init; }
    public string Username { get; init; } = string.Empty;
    public DateTime JoinedAt { get; init; }
}
