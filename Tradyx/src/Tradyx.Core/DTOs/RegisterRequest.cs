using System.ComponentModel.DataAnnotations;

namespace Tradyx.Core.DTOs;

/// <summary>
/// Request model for user registration.
/// </summary>
public record RegisterRequest
{
    [Required(ErrorMessage = "Username is required")]
    [StringLength(50, MinimumLength = 3, ErrorMessage = "Username must be between 3 and 50 characters")]
    public required string Username { get; init; }

    [Required(ErrorMessage = "Email is required")]
    [EmailAddress(ErrorMessage = "Invalid email format")]
    public required string Email { get; init; }

    [Required(ErrorMessage = "Password is required")]
    [StringLength(100, MinimumLength = 8, ErrorMessage = "Password must be at least 8 characters")]
    public required string Password { get; init; }

    /// <summary>
    /// Optional username of the referrer.
    /// </summary>
    public string? ReferrerUsername { get; init; }
}
