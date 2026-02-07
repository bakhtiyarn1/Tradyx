namespace Tradyx.Core.DTOs.Admin;

public record InvestmentInfoResponse
{
    public Guid Id { get; init; }
    public Guid UserId { get; init; }
    public string Username { get; init; } = string.Empty;
    public string Email { get; init; } = string.Empty;
    public decimal Amount { get; init; }
    public decimal DailyRate { get; init; }
    public decimal DailyPayout { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime NextPayoutAt { get; init; }
    public bool IsActive { get; init; }
}
