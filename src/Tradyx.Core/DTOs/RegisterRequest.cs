using System.ComponentModel.DataAnnotations;

namespace Tradyx.Core.DTOs;

public record RegisterRequest
{
    [Required, MinLength(3), MaxLength(50)]
    public string Username { get; init; } = string.Empty;

    [Required, EmailAddress, MaxLength(255)]
    public string Email { get; init; } = string.Empty;

    [Required, MinLength(8), MaxLength(128)]
    public string Password { get; init; } = string.Empty;

    public string? ReferrerCode { get; init; }
}
