namespace Tradyx.Core.DTOs;

public record InvestmentResponse
{
    public bool Success { get; init; }
    public string? Message { get; init; }
    public Guid? Id { get; init; }
    public decimal Amount { get; init; }
    public decimal DailyRate { get; init; }
    public DateTime? CreatedAt { get; init; }
    public DateTime? NextPayoutAt { get; init; }
    public bool IsActive { get; init; }
    public int RemainingPayouts { get; init; }

    public static InvestmentResponse Ok(Guid id, decimal amount, decimal dailyRate, DateTime createdAt, DateTime nextPayoutAt, int remainingPayouts) => new()
    {
        Success = true,
        Id = id,
        Amount = amount,
        DailyRate = dailyRate,
        CreatedAt = createdAt,
        NextPayoutAt = nextPayoutAt,
        IsActive = true,
        RemainingPayouts = remainingPayouts
    };

    public static InvestmentResponse Fail(string message) => new()
    {
        Success = false,
        Message = message
    };

    public static InvestmentResponse FromEntity(Tradyx.Core.Entities.Investment inv) => new()
    {
        Success = true,
        Id = inv.Id,
        Amount = inv.Amount,
        DailyRate = inv.DailyRate,
        CreatedAt = inv.CreatedAt,
        NextPayoutAt = inv.NextPayoutAt,
        IsActive = inv.IsActive,
        RemainingPayouts = inv.RemainingPayouts
    };
}
