using Tradyx.Core.DTOs;

namespace Tradyx.Core.Interfaces;

public interface IAuthService
{
    Task<AuthResponse> RegisterAsync(RegisterRequest request, string? clientIp = null, CancellationToken cancellationToken = default);
    Task<LoginResponse> LoginAsync(LoginRequest request, CancellationToken cancellationToken = default);

    /// <summary>Create a pending auth token for Telegram deeplink flow.</summary>
    TelegramAuthInitResponse InitTelegramAuth(string? referrerCode = null);

    /// <summary>Called by the bot to confirm a pending auth token with Telegram user data.</summary>
    Task<bool> ConfirmTelegramAuthAsync(TelegramAuthConfirmRequest request, string? clientIp = null, CancellationToken cancellationToken = default);

    /// <summary>Polled by the frontend to check if auth token has been confirmed.</summary>
    TelegramAuthCheckResponse CheckTelegramAuth(string token);
}
