using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Tradyx.Core.DTOs;
using Tradyx.Core.Interfaces;

namespace Tradyx.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
[Authorize]
public class InvestmentController : ControllerBase
{
    private readonly IInvestmentService _investmentService;
    private readonly ILogger<InvestmentController> _logger;

    public InvestmentController(IInvestmentService investmentService, ILogger<InvestmentController> logger)
    {
        _investmentService = investmentService;
        _logger = logger;
    }

    /// <summary>
    /// Purchases a new investment for the current user.
    /// </summary>
    /// <param name="request">Purchase request with amount only (user ID taken from token).</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Investment response with details.</returns>
    [HttpPost("purchase")]
    [ProducesResponseType(typeof(InvestmentResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(InvestmentResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Purchase(
        [FromBody] InvestmentRequest request,
        CancellationToken cancellationToken)
    {
        var userId = GetCurrentUserId();
        if (userId == null)
            return Unauthorized(new { Message = "Invalid token" });

        if (!ModelState.IsValid)
        {
            var errors = ModelState.Values
                .SelectMany(v => v.Errors)
                .Select(e => e.ErrorMessage)
                .ToList();

            return BadRequest(InvestmentResponse.Fail(string.Join(" ", errors)));
        }

        var response = await _investmentService.PurchaseAsync(userId.Value, request.Amount, cancellationToken);

        if (!response.Success)
        {
            return BadRequest(response);
        }

        return Ok(response);
    }

    /// <summary>
    /// Gets all investments for the current user.
    /// </summary>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>List of user investments.</returns>
    [HttpGet("my")]
    [ProducesResponseType(typeof(IEnumerable<InvestmentResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMyInvestments(CancellationToken cancellationToken)
    {
        var userId = GetCurrentUserId();
        if (userId == null)
            return Unauthorized(new { Message = "Invalid token" });

        var investments = await _investmentService.GetUserInvestmentsAsync(userId.Value, cancellationToken);
        return Ok(investments);
    }

    /// <summary>
    /// Gets user ID from JWT token claims.
    /// </summary>
    private Guid? GetCurrentUserId()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
            return null;
        return userId;
    }
}
