namespace Tradyx.Core.DTOs.Admin;

public record InvestmentPlanDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = "";
    public decimal MinAmount { get; init; }
    public decimal MaxAmount { get; init; }
    public decimal DailyRate { get; init; }
    public int DurationDays { get; init; }
    public bool IsActive { get; init; }
    public int SortOrder { get; init; }
    public string Description { get; init; } = "";
    public string Color { get; init; } = "blue";
    public DateTime CreatedAt { get; init; }
    public DateTime UpdatedAt { get; init; }
    public int ActiveInvestments { get; init; }
    public decimal TotalInvested { get; init; }
}

public record CreatePlanRequest
{
    public string Name { get; init; } = "";
    public decimal MinAmount { get; init; }
    public decimal MaxAmount { get; init; }
    public decimal DailyRate { get; init; }
    public int DurationDays { get; init; } = 30;
    public string Description { get; init; } = "";
    public string Color { get; init; } = "blue";
}

public record UpdatePlanRequest
{
    public string? Name { get; init; }
    public decimal? MinAmount { get; init; }
    public decimal? MaxAmount { get; init; }
    public decimal? DailyRate { get; init; }
    public int? DurationDays { get; init; }
    public bool? IsActive { get; init; }
    public string? Description { get; init; }
    public string? Color { get; init; }
}

public record AnalyticsResponse
{
    public List<DailyStatPoint> DailyStats { get; init; } = new();
    public List<PlanDistribution> PlanDistribution { get; init; } = new();
    public FinancialSummary Financial { get; init; } = new();
    public UserGrowth UserGrowth { get; init; } = new();
}

public record DailyStatPoint
{
    public string Date { get; init; } = "";
    public decimal Deposits { get; init; }
    public decimal Withdrawals { get; init; }
    public decimal ProfitPaid { get; init; }
    public decimal ReferralPaid { get; init; }
    public int NewUsers { get; init; }
    public int NewInvestments { get; init; }
}

public record PlanDistribution
{
    public string Name { get; init; } = "";
    public string Color { get; init; } = "blue";
    public int Count { get; init; }
    public decimal TotalAmount { get; init; }
}

public record FinancialSummary
{
    public decimal TotalDeposits { get; init; }
    public decimal TotalWithdrawals { get; init; }
    public decimal TotalProfitPaid { get; init; }
    public decimal TotalReferralPaid { get; init; }
    public decimal PlatformRevenue { get; init; }
    public decimal PendingWithdrawals { get; init; }
    public decimal ActiveInvestmentsTotal { get; init; }
}

public record UserGrowth
{
    public int TotalUsers { get; init; }
    public int ActiveUsers7d { get; init; }
    public int NewUsersToday { get; init; }
    public int NewUsersWeek { get; init; }
    public Dictionary<string, int> RankDistribution { get; init; } = new();
}
