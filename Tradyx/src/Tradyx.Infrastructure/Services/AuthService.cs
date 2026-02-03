using Microsoft.Extensions.Logging;
using Tradyx.Core.DTOs;
using Tradyx.Core.Entities;
using Tradyx.Core.Interfaces;

namespace Tradyx.Infrastructure.Services;

/// <summary>
/// Implementation of authentication service.
/// </summary>
public class AuthService : IAuthService
{
    private readonly IUserRepository _userRepository;
    private readonly IPasswordHasher _passwordHasher;
    private readonly ILogger<AuthService> _logger;

    public AuthService(
        IUserRepository userRepository,
        IPasswordHasher passwordHasher,
        ILogger<AuthService> logger)
    {
        _userRepository = userRepository;
        _passwordHasher = passwordHasher;
        _logger = logger;
    }

    public async Task<AuthResponse> RegisterAsync(RegisterRequest request, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Registration attempt for user: {Username}, email: {Email}", 
            request.Username, request.Email);

        // Check if email is already taken
        var existingByEmail = await _userRepository.GetByEmailAsync(request.Email, cancellationToken);
        if (existingByEmail is not null)
        {
            _logger.LogWarning("Registration failed: Email {Email} is already registered", request.Email);
            return AuthResponse.Fail("Email is already registered.");
        }

        // Check if username is already taken
        var existingByUsername = await _userRepository.GetByUsernameAsync(request.Username, cancellationToken);
        if (existingByUsername is not null)
        {
            _logger.LogWarning("Registration failed: Username {Username} is already taken", request.Username);
            return AuthResponse.Fail("Username is already taken.");
        }

        // Handle referral system
        Guid? referrerId = null;
        if (!string.IsNullOrWhiteSpace(request.ReferrerUsername))
        {
            var referrer = await _userRepository.GetByUsernameAsync(request.ReferrerUsername, cancellationToken);
            if (referrer is not null)
            {
                referrerId = referrer.Id;
                _logger.LogInformation("Referrer found: {ReferrerUsername} (ID: {ReferrerId})", 
                    request.ReferrerUsername, referrerId);
            }
            else
            {
                _logger.LogWarning("Referrer username {ReferrerUsername} not found, proceeding without referrer", 
                    request.ReferrerUsername);
            }
        }

        // Hash password
        var passwordHash = _passwordHasher.Hash(request.Password);

        // Create user entity
        var user = User.Create(
            username: request.Username,
            email: request.Email,
            passwordHash: passwordHash,
            balance: 0,
            referrerId: referrerId
        );

        // Save user
        try
        {
            var createdUser = await _userRepository.AddAsync(user, cancellationToken);
            
            _logger.LogInformation("User registered successfully: {Username} (ID: {UserId})", 
                createdUser.Username, createdUser.Id);

            return AuthResponse.Ok(
                message: "Registration successful.",
                userId: createdUser.Id
            );
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to save user {Username} to database", request.Username);
            return AuthResponse.Fail("An error occurred during registration. Please try again.");
        }
    }
}
