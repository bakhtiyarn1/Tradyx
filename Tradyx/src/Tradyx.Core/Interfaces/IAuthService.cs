using Tradyx.Core.DTOs;

namespace Tradyx.Core.Interfaces;

/// <summary>
/// Service interface for authentication operations.
/// </summary>
public interface IAuthService
{
    /// <summary>
    /// Registers a new user.
    /// </summary>
    /// <param name="request">Registration request containing user details.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Authentication response with success status and message.</returns>
    Task<AuthResponse> RegisterAsync(RegisterRequest request, CancellationToken cancellationToken = default);
}
