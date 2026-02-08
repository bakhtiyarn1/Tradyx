namespace Tradyx.Core.Entities;

public class InvestmentPlan
{
    public Guid Id { get; set; }
    public string Name { get; set; } = "";
    public decimal MinAmount { get; set; }
    public decimal MaxAmount { get; set; }
    public decimal DailyRate { get; set; }
    public int DurationDays { get; set; } = 30;
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; }
    public string Description { get; set; } = "";
    public string Color { get; set; } = "blue";
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
