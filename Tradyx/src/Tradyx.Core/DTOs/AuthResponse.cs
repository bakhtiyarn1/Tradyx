namespace Tradyx.Core.DTOs;

/// <summary>
/// Response model for authentication operations.
/// </summary>
public record AuthResponse
{
    public bool Success { get; init; }
    public string Message { get; init; } = string.Empty;
    public string? Token { get; init; }
    public Guid? UserId { get; init; }

    /// <summary>
    /// Creates a successful response.
    /// </summary>
    public static AuthResponse Ok(string message, Guid? userId = null, string? token = null)
        => new() { Success = true, Message = message, UserId = userId, Token = token };

    /// <summary>
    /// Creates a failure response.
    /// </summary>
    public static AuthResponse Fail(string message)
        => new() { Success = false, Message = message };
}
