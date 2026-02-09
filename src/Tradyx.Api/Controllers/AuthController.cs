using Microsoft.AspNetCore.Mvc;
using Tradyx.Core.DTOs;
using Tradyx.Core.Interfaces;

namespace Tradyx.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly ILogger<AuthController> _logger;

    public AuthController(IAuthService authService, ILogger<AuthController> logger)
    {
        _authService = authService;
        _logger = logger;
    }

    [HttpPost("register")]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Register(
        [FromBody] RegisterRequest request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            var errors = ModelState.Values.SelectMany(v => v.Errors).Select(e => e.ErrorMessage).ToList();
            return BadRequest(AuthResponse.Fail(string.Join(" ", errors)));
        }

        try
        {
            // Extract client IP for anti-fraud tracking (S4)
            var clientIp = HttpContext.Connection.RemoteIpAddress?.ToString();
            _logger.LogInformation("[Auth] Registration attempt for {Email} from IP {Ip}", request.Email, clientIp);

            var response = await _authService.RegisterAsync(request, clientIp, cancellationToken);

            if (!response.Success)
            {
                _logger.LogWarning("[Auth] Registration failed for {Email}: {Reason}", request.Email, response.Message);
                return BadRequest(response);
            }

            _logger.LogInformation("[Auth] User registered: {Email} ({Username})", request.Email, request.Username);
            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Auth] Registration error for {Email}", request.Email);
            return StatusCode(500, AuthResponse.Fail("An internal error occurred. Please try again."));
        }
    }

    [HttpPost("login")]
    [ProducesResponseType(typeof(LoginResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(LoginResponse), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Login(
        [FromBody] LoginRequest request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            var errors = ModelState.Values.SelectMany(v => v.Errors).Select(e => e.ErrorMessage).ToList();
            return BadRequest(LoginResponse.Fail(string.Join(" ", errors)));
        }

        try
        {
            _logger.LogInformation("[Auth] Login attempt for {Email}", request.Email);

            var response = await _authService.LoginAsync(request, cancellationToken);

            if (!response.Success)
            {
                _logger.LogWarning("[Auth] Login failed for {Email}", request.Email);
                return Unauthorized(response);
            }

            _logger.LogInformation("[Auth] Login success for {Email}", request.Email);
            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Auth] Login error for {Email}", request.Email);
            return StatusCode(500, LoginResponse.Fail("An internal error occurred. Please try again."));
        }
    }

    // ── Telegram Auth Flow ───────────────────────────────────────────

    /// <summary>Step 1: Frontend calls this to get a deeplink URL for Telegram bot.</summary>
    [HttpPost("telegram/init")]
    [ProducesResponseType(typeof(TelegramAuthInitResponse), StatusCodes.Status200OK)]
    public IActionResult TelegramInit([FromQuery] string? ref_code)
    {
        try
        {
            var response = _authService.InitTelegramAuth(ref_code);
            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Auth] Telegram init error");
            return StatusCode(500, new { message = "Internal error" });
        }
    }

    /// <summary>Step 2: Bot calls this to confirm auth token with Telegram user data.</summary>
    [HttpPost("telegram/confirm")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> TelegramConfirm(
        [FromBody] TelegramAuthConfirmRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var clientIp = HttpContext.Connection.RemoteIpAddress?.ToString();
            var success = await _authService.ConfirmTelegramAuthAsync(request, clientIp, cancellationToken);
            return success ? Ok(new { success = true }) : BadRequest(new { success = false, message = "Invalid or expired token" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Auth] Telegram confirm error");
            return StatusCode(500, new { message = "Internal error" });
        }
    }

    /// <summary>Step 3: Frontend polls this to check if auth is confirmed.</summary>
    [HttpGet("telegram/check")]
    [ProducesResponseType(typeof(TelegramAuthCheckResponse), StatusCodes.Status200OK)]
    public IActionResult TelegramCheck([FromQuery] string token)
    {
        try
        {
            var response = _authService.CheckTelegramAuth(token);
            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Auth] Telegram check error");
            return StatusCode(500, new { message = "Internal error" });
        }
    }
}
