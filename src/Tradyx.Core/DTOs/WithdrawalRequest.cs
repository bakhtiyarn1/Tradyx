using System.ComponentModel.DataAnnotations;

namespace Tradyx.Core.DTOs;

public record WithdrawalRequest
{
    [Required, Range(10, 1000000)]
    public decimal Amount { get; init; }

    [MaxLength(200)]
    public string? WalletAddress { get; init; }
}
