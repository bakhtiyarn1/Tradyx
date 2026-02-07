namespace Tradyx.Core.DTOs.User;

public record UserDashboardResponse
{
    public decimal Balance { get; init; }
    public decimal ActiveInvestmentsAmount { get; init; }
    public decimal TotalEarned { get; init; }
    public decimal TodayProfit { get; init; }
    public decimal TodayReferralBonus { get; init; }
    public int ReferralsCount { get; init; }
    public DateTime? NextPayoutAt { get; init; }
}
