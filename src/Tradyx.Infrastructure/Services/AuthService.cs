using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;
using Tradyx.Core.DTOs;
using Tradyx.Core.Entities;
using Tradyx.Core.Interfaces;

namespace Tradyx.Infrastructure.Services;

public class AuthService : IAuthService
{
    private readonly IUserRepository _userRepository;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IConfiguration _configuration;
    private readonly ILogger<AuthService> _logger;

    public AuthService(
        IUserRepository userRepository, IPasswordHasher passwordHasher,
        IConfiguration configuration, ILogger<AuthService> logger)
    {
        _userRepository = userRepository;
        _passwordHasher = passwordHasher;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<AuthResponse> RegisterAsync(RegisterRequest request, string? clientIp = null, CancellationToken cancellationToken = default)
    {
        try
        {
            // Check existing email
            var existingEmail = await _userRepository.GetByEmailAsync(request.Email, cancellationToken);
            if (existingEmail != null)
                return AuthResponse.Fail("Email already registered");

            // Check existing username
            var existingUsername = await _userRepository.GetByUsernameAsync(request.Username, cancellationToken);
            if (existingUsername != null)
                return AuthResponse.Fail("Username already taken");

            // Resolve referrer by invite code (or username for backward compat)
            User? referrer = null;
            if (!string.IsNullOrEmpty(request.ReferrerCode))
            {
                // Try invite code first, then username as fallback
                referrer = await _userRepository.GetByInviteCodeAsync(request.ReferrerCode, cancellationToken)
                        ?? await _userRepository.GetByUsernameAsync(request.ReferrerCode, cancellationToken);
            }

            // Build referral path: parent's path + parent's id
            string? referralPath = null;
            if (referrer != null)
            {
                referralPath = string.IsNullOrEmpty(referrer.ReferralPath)
                    ? referrer.Id.ToString()
                    : $"{referrer.ReferralPath}/{referrer.Id}";
            }

            // S4 Anti-Fraud: check if referrer has the same registration IP
            var isSuspicious = false;
            if (referrer != null && !string.IsNullOrEmpty(clientIp) && !string.IsNullOrEmpty(referrer.RegistrationIp))
            {
                if (string.Equals(referrer.RegistrationIp, clientIp, StringComparison.OrdinalIgnoreCase))
                {
                    isSuspicious = true;
                    _logger.LogWarning("[Auth] SUSPICIOUS: New user {Email} has same IP ({Ip}) as referrer {ReferrerUsername}",
                        request.Email, clientIp, referrer.Username);
                }
            }

            var user = new User
            {
                Id = Guid.NewGuid(),
                Username = request.Username,
                Email = request.Email,
                PasswordHash = _passwordHasher.Hash(request.Password),
                Balance = 0,
                ReferrerId = referrer?.Id,
                InviteCode = User.GenerateInviteCode(),
                ReferralPath = referralPath,
                RegistrationIp = clientIp,
                IsSuspicious = isSuspicious,
                CreatedAt = DateTime.UtcNow
            };

            // Prevent self-referral (defensive)
            if (user.ReferrerId == user.Id)
                user.ReferrerId = null;

            await _userRepository.CreateAsync(user, cancellationToken);
            _logger.LogInformation("[Auth] Registered user {Username} ({Email}), invite={InviteCode}, referrer={ReferrerId}, ip={Ip}, suspicious={Suspicious}",
                user.Username, user.Email, user.InviteCode, user.ReferrerId, clientIp, isSuspicious);

            var token = GenerateJwtToken(user);
            return AuthResponse.Ok(token, new AuthUserDto
            {
                Id = user.Id,
                Username = user.Username,
                Email = user.Email,
                Balance = user.Balance
            });
        }
        catch (Npgsql.PostgresException ex) when (ex.SqlState == "23505") // unique_violation
        {
            _logger.LogWarning("[Auth] Duplicate registration attempt for {Email}", request.Email);
            return AuthResponse.Fail("Email or username already registered");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Auth] Registration error for {Email}", request.Email);
            throw;
        }
    }

    public async Task<LoginResponse> LoginAsync(LoginRequest request, CancellationToken cancellationToken = default)
    {
        try
        {
            var user = await _userRepository.GetByEmailAsync(request.Email, cancellationToken);
            if (user == null)
                return LoginResponse.Fail("Invalid email or password");

            if (!_passwordHasher.Verify(request.Password, user.PasswordHash))
                return LoginResponse.Fail("Invalid email or password");

            _logger.LogInformation("[Auth] Login success for {Email}", request.Email);

            var token = GenerateJwtToken(user);
            return LoginResponse.Ok(token, new AuthUserDto
            {
                Id = user.Id,
                Username = user.Username,
                Email = user.Email,
                Balance = user.Balance
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Auth] Login error for {Email}", request.Email);
            throw;
        }
    }

    private string GenerateJwtToken(User user)
    {
        var jwtSettings = _configuration.GetSection("JwtSettings");
        var secret = jwtSettings["Secret"]!;
        var issuer = jwtSettings["Issuer"]!;
        var audience = jwtSettings["Audience"]!;
        var expiryMinutes = int.Parse(jwtSettings["ExpiryMinutes"] ?? "1440");

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.Username),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: issuer, audience: audience,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(expiryMinutes),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
