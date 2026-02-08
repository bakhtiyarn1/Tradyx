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
}
