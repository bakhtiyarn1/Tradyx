namespace Tradyx.Core.DTOs;

public record LoginResponse
{
    public bool Success { get; init; }
    public string? Message { get; init; }
    public string? Token { get; init; }
    public AuthUserDto? User { get; init; }

    public static LoginResponse Ok(string token, AuthUserDto user) => new()
    {
        Success = true,
        Token = token,
        User = user
    };

    public static LoginResponse Fail(string message) => new()
    {
        Success = false,
        Message = message
    };
}
