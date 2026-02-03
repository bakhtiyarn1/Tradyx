namespace Tradyx.Core.DTOs;

/// <summary>
/// Response model for investment operations.
/// </summary>
public record InvestmentResponse
{
    public bool Success { get; init; }
    public string Message { get; init; } = string.Empty;
    public Guid? InvestmentId { get; init; }
    public decimal? DailyRate { get; init; }
    public decimal? DailyPayout { get; init; }

    public static InvestmentResponse Ok(string message, Guid investmentId, decimal dailyRate, decimal dailyPayout)
        => new()
        {
            Success = true,
            Message = message,
            InvestmentId = investmentId,
            DailyRate = dailyRate,
            DailyPayout = dailyPayout
        };

    public static InvestmentResponse Fail(string message)
        => new() { Success = false, Message = message };
}
