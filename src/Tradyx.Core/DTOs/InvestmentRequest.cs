using System.ComponentModel.DataAnnotations;

namespace Tradyx.Core.DTOs;

public record InvestmentRequest
{
    [Required, Range(20, 100000)]
    public decimal Amount { get; init; }
}
