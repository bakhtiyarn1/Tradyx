using Microsoft.AspNetCore.Mvc;
using Tradyx.Core.DTOs;
using Tradyx.Core.Services;

namespace Tradyx.Api.Controllers
{
    [ApiController]
    [Route("api/auth")]
    public class AuthController : ControllerBase
    {
        private readonly AuthService _authService;

        public AuthController(AuthService authService)
        {
            _authService = authService;
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterRequest request)
        {
            await _authService.RegisterAsync(request);
            return Ok(new { message = "User registered successfully" });
        }
    }
}