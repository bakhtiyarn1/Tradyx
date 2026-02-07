namespace Tradyx.Core.DTOs;

public record AuthResponse
{
    public bool Success { get; init; }
    public string? Message { get; init; }
    public string? Token { get; init; }
    public AuthUserDto? User { get; init; }

    public static AuthResponse Ok(string token, AuthUserDto user) => new()
    {
        Success = true,
        Token = token,
        User = user
    };

    public static AuthResponse Fail(string message) => new()
    {
        Success = false,
        Message = message
    };
}

public record AuthUserDto
{
    public Guid Id { get; init; }
    public string Username { get; init; } = string.Empty;
    public string Email { get; init; } = string.Empty;
    public decimal Balance { get; init; }
}
