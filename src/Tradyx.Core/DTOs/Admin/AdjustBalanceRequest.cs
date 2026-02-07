using System.ComponentModel.DataAnnotations;

namespace Tradyx.Core.DTOs.Admin;

public record AdjustBalanceRequest
{
    [Required]
    public decimal Amount { get; init; }

    [MaxLength(200)]
    public string? Reason { get; init; }
}
