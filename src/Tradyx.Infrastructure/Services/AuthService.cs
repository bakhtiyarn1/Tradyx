using System.Collections.Concurrent;
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
    private readonly ITelegramNotifier _telegram;
    private readonly ILogger<AuthService> _logger;

    /// <summary>In-memory store for pending Telegram auth tokens. Expires after 5 min.</summary>
    private static readonly ConcurrentDictionary<string, TelegramPendingAuth> _pendingAuths = new();

    private class TelegramPendingAuth
    {
        public string Token { get; set; } = "";
        public string? ReferrerCode { get; set; }
        public DateTime ExpiresAt { get; set; }
        // Set after bot confirms:
        public bool Confirmed { get; set; }
        public string? JwtToken { get; set; }
        public AuthUserDto? User { get; set; }
    }

    public AuthService(
        IUserRepository userRepository, IPasswordHasher passwordHasher,
        IConfiguration configuration, ITelegramNotifier telegram, ILogger<AuthService> logger)
    {
        _userRepository = userRepository;
        _passwordHasher = passwordHasher;
        _configuration = configuration;
        _telegram = telegram;
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

            // Telegram admin notification
            _ = _telegram.NotifyAsync(
                $"👤 <b>Новый пользователь</b>\n\n" +
                $"📛 Username: <code>{user.Username}</code>\n" +
                $"📧 Email: <code>{user.Email}</code>\n" +
                $"🔗 Реферер: {(referrer != null ? $"<code>{referrer.Username}</code>" : "—")}\n" +
                $"🔑 Invite code: <code>{user.InviteCode}</code>" +
                (isSuspicious ? "\n⚠️ <b>ПОДОЗРИТЕЛЬНЫЙ</b> (совпадение IP с реферером)" : ""));

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

    // ── Telegram Auth Flow ───────────────────────────────────────────

    public TelegramAuthInitResponse InitTelegramAuth(string? referrerCode = null)
    {
        // Cleanup expired tokens
        var expired = _pendingAuths.Where(kv => kv.Value.ExpiresAt < DateTime.UtcNow).Select(kv => kv.Key).ToList();
        foreach (var key in expired) _pendingAuths.TryRemove(key, out _);

        var token = Guid.NewGuid().ToString("N")[..16]; // 16-char hex token
        var botUsername = _configuration["Telegram:BotUsername"] ?? "TradyxAI_bot";

        var pending = new TelegramPendingAuth
        {
            Token = token,
            ReferrerCode = referrerCode,
            ExpiresAt = DateTime.UtcNow.AddMinutes(5)
        };

        _pendingAuths[token] = pending;

        var startParam = string.IsNullOrEmpty(referrerCode)
            ? $"auth_{token}"
            : $"auth_{token}_ref_{referrerCode}";

        _logger.LogInformation("[TgAuth] Init token {Token}, ref={Ref}", token, referrerCode);

        return new TelegramAuthInitResponse
        {
            Token = token,
            BotUrl = $"https://t.me/{botUsername}?start={startParam}"
        };
    }

    public async Task<bool> ConfirmTelegramAuthAsync(TelegramAuthConfirmRequest request, string? clientIp = null, CancellationToken cancellationToken = default)
    {
        // Verify internal secret
        var expectedSecret = _configuration["Telegram:InternalSecret"] ?? "tradyx-internal-secret";
        if (request.Secret != expectedSecret)
        {
            _logger.LogWarning("[TgAuth] Invalid internal secret for token {Token}", request.Token);
            return false;
        }

        if (!_pendingAuths.TryGetValue(request.Token, out var pending) || pending.ExpiresAt < DateTime.UtcNow)
        {
            _logger.LogWarning("[TgAuth] Token {Token} not found or expired", request.Token);
            return false;
        }

        try
        {
            // Check if user exists by telegram_id
            var user = await _userRepository.GetByTelegramIdAsync(request.TelegramId, cancellationToken);

            if (user == null)
            {
                // Auto-register with Telegram data
                var username = !string.IsNullOrEmpty(request.TelegramUsername)
                    ? request.TelegramUsername
                    : $"tg_{request.TelegramId}";

                // Ensure unique username
                var existing = await _userRepository.GetByUsernameAsync(username, cancellationToken);
                if (existing != null)
                    username = $"{username}_{Guid.NewGuid().ToString("N")[..4]}";

                // Use referrer code from the pending auth (set during init) or from the confirm request
                var refCode = request.ReferrerCode ?? pending.ReferrerCode;

                // Resolve referrer
                User? referrer = null;
                if (!string.IsNullOrEmpty(refCode))
                {
                    referrer = await _userRepository.GetByInviteCodeAsync(refCode, cancellationToken)
                            ?? await _userRepository.GetByUsernameAsync(refCode, cancellationToken);
                }

                string? referralPath = null;
                if (referrer != null)
                {
                    referralPath = string.IsNullOrEmpty(referrer.ReferralPath)
                        ? referrer.Id.ToString()
                        : $"{referrer.ReferralPath}/{referrer.Id}";
                }

                user = new User
                {
                    Id = Guid.NewGuid(),
                    Username = username,
                    Email = $"tg_{request.TelegramId}@telegram.user",
                    PasswordHash = _passwordHasher.Hash(Guid.NewGuid().ToString()), // random pw
                    Balance = 0,
                    TelegramId = request.TelegramId,
                    ReferrerId = referrer?.Id,
                    InviteCode = User.GenerateInviteCode(),
                    ReferralPath = referralPath,
                    RegistrationIp = clientIp,
                    IsSuspicious = false,
                    CreatedAt = DateTime.UtcNow
                };

                user = await _userRepository.CreateAsync(user, cancellationToken);
                _logger.LogInformation("[TgAuth] Auto-registered Telegram user {Username} (tg:{TgId})", user.Username, request.TelegramId);

                // Telegram admin notification
                _ = _telegram.NotifyAsync(
                    $"👤 <b>Новый пользователь (Telegram)</b>\n\n" +
                    $"📛 Username: <code>{user.Username}</code>\n" +
                    $"📱 Telegram: {(!string.IsNullOrEmpty(request.TelegramUsername) ? $"@{request.TelegramUsername}" : $"ID {request.TelegramId}")}\n" +
                    $"🔗 Реферер: {(referrer != null ? $"<code>{referrer.Username}</code>" : "—")}\n" +
                    $"🔑 Invite code: <code>{user.InviteCode}</code>");
            }

            // Generate JWT
            var jwt = GenerateJwtToken(user);

            // Mark pending auth as confirmed
            pending.Confirmed = true;
            pending.JwtToken = jwt;
            pending.User = new AuthUserDto
            {
                Id = user.Id,
                Username = user.Username,
                Email = user.Email,
                Balance = user.Balance
            };

            _logger.LogInformation("[TgAuth] Confirmed token {Token} for user {Username}", request.Token, user.Username);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[TgAuth] Error confirming token {Token}", request.Token);
            return false;
        }
    }

    public TelegramAuthCheckResponse CheckTelegramAuth(string token)
    {
        if (!_pendingAuths.TryGetValue(token, out var pending) || pending.ExpiresAt < DateTime.UtcNow)
        {
            return new TelegramAuthCheckResponse { Confirmed = false };
        }

        if (pending.Confirmed)
        {
            // Remove after successful check (one-time use)
            _pendingAuths.TryRemove(token, out _);
            return new TelegramAuthCheckResponse
            {
                Confirmed = true,
                JwtToken = pending.JwtToken,
                User = pending.User
            };
        }

        return new TelegramAuthCheckResponse { Confirmed = false };
    }

    // ── JWT ──────────────────────────────────────────────────────────

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
