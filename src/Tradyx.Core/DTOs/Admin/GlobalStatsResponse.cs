namespace Tradyx.Core.DTOs.Admin;

public record GlobalStatsResponse
{
    public int TotalUsers { get; init; }
    public decimal TotalInvested { get; init; }
    public decimal TotalProfitPaid { get; init; }
    public decimal TotalReferralPaid { get; init; }
    public decimal SystemReserve { get; init; }
    public int ActiveInvestmentsCount { get; init; }
    public DateTime GeneratedAt { get; init; } = DateTime.UtcNow;
}
