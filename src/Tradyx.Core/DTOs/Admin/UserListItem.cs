namespace Tradyx.Core.DTOs.Admin;

public record UserListItem
{
    public Guid Id { get; init; }
    public string Username { get; init; } = string.Empty;
    public string Email { get; init; } = string.Empty;
    public decimal Balance { get; init; }
    public int InvestmentsCount { get; init; }
    public decimal TotalInvested { get; init; }
    public decimal TotalEarned { get; init; }
    public int ReferralsCount { get; init; }
    public DateTime CreatedAt { get; init; }
}
