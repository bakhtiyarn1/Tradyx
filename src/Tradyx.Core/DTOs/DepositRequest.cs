using System.ComponentModel.DataAnnotations;

namespace Tradyx.Core.DTOs;

public record DepositRequest
{
    [Required, Range(1, 1000000)]
    public decimal Amount { get; init; }
}
