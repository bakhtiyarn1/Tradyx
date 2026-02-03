using System.ComponentModel.DataAnnotations;

namespace Tradyx.Core.DTOs;

/// <summary>
/// Request model for purchasing an investment.
/// </summary>
public record PurchaseInvestmentRequest
{
    [Required]
    public Guid UserId { get; init; }

    [Required]
    [Range(20, double.MaxValue, ErrorMessage = "Minimum investment amount is $20")]
    public decimal Amount { get; init; }
}
