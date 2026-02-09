namespace Tradyx.Core.DTOs;

/// <summary>Response when frontend initiates Telegram auth flow.</summary>
public record TelegramAuthInitResponse
{
    public string Token { get; init; } = "";
    public string BotUrl { get; init; } = "";
}

/// <summary>Request from Telegram bot to confirm a pending auth token.</summary>
public record TelegramAuthConfirmRequest
{
    public string Token { get; init; } = "";
    public long TelegramId { get; init; }
    public string? TelegramUsername { get; init; }
    public string? FirstName { get; init; }
    public string? LastName { get; init; }
    public string? ReferrerCode { get; init; }
    /// <summary>Internal secret so only the bot can call this endpoint.</summary>
    public string Secret { get; init; } = "";
}

/// <summary>Response when frontend polls to check if auth is confirmed.</summary>
public record TelegramAuthCheckResponse
{
    public bool Confirmed { get; init; }
    public string? JwtToken { get; init; }
    public AuthUserDto? User { get; init; }
}
