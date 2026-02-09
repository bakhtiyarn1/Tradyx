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
    private readonly IUserRepository _userRepository;
    private readonly IRealtimeNotifier _realtime;
    private readonly ILogger<InvestmentController> _logger;

    public InvestmentController(
        IInvestmentService investmentService,
        IUserRepository userRepository,
        IRealtimeNotifier realtime,
        ILogger<InvestmentController> logger)
    {
        _investmentService = investmentService;
        _userRepository = userRepository;
        _realtime = realtime;
        _logger = logger;
    }

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
            var errors = ModelState.Values.SelectMany(v => v.Errors).Select(e => e.ErrorMessage).ToList();
            return BadRequest(InvestmentResponse.Fail(string.Join(" ", errors)));
        }

        try
        {
            _logger.LogInformation("[Investment] User {UserId} purchasing ${Amount:F2}", userId, request.Amount);

            var response = await _investmentService.PurchaseAsync(userId.Value, request.Amount, cancellationToken);

            if (!response.Success)
            {
                _logger.LogWarning("[Investment] Purchase failed for {UserId}: {Reason}", userId, response.Message);
                return BadRequest(response);
            }

            _logger.LogInformation("[Investment] User {UserId} invested ${Amount:F2} at {Rate}%", userId, request.Amount, response.DailyRate * 100);

            // Real-time: push updated balance + investment event
            _ = Task.Run(async () =>
            {
                try
                {
                    var user = await _userRepository.GetByIdAsync(userId.Value);
                    if (user != null)
                    {
                        await _realtime.NotifyBalanceUpdated(userId.Value, user.Balance);
                        await _realtime.NotifyInvestmentUpdated(userId.Value);
                        await _realtime.NotifyTransactionCreated(userId.Value, "Investment", -request.Amount);
                        await _realtime.NotifyNewNotification(userId.Value,
                            $"🎯 Investment ${request.Amount:F2} activated at {response.DailyRate * 100:F1}% daily");
                    }
                }
                catch { /* non-critical */ }
            });

            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Investment] Purchase error for user {UserId}", userId);
            return StatusCode(500, InvestmentResponse.Fail("An internal error occurred. Please try again."));
        }
    }

    /// <summary>Returns all active investment plans from the database.</summary>
    [HttpGet("plans")]
    [AllowAnonymous]
    public async Task<IActionResult> GetPlans(CancellationToken cancellationToken)
    {
        try
        {
            var plans = await _investmentService.GetActivePlansAsync(cancellationToken);
            return Ok(plans);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Investment] Error fetching plans");
            return StatusCode(500, new { Message = "Failed to load investment plans" });
        }
    }

    [HttpGet("my")]
    [ProducesResponseType(typeof(IEnumerable<InvestmentResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMyInvestments(CancellationToken cancellationToken)
    {
        var userId = GetCurrentUserId();
        if (userId == null)
            return Unauthorized(new { Message = "Invalid token" });

        try
        {
            var investments = await _investmentService.GetUserInvestmentsAsync(userId.Value, cancellationToken);
            return Ok(investments);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Investment] Error fetching investments for {UserId}", userId);
            return StatusCode(500, new { Message = "Failed to load investments" });
        }
    }

    /// <summary>Early exit from an active investment (with fee, after lock period).</summary>
    [HttpPost("{investmentId}/early-exit")]
    public async Task<IActionResult> EarlyExit(Guid investmentId, CancellationToken cancellationToken)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized(new { Message = "Invalid token" });

        try
        {
            var result = await _investmentService.RequestEarlyExitAsync(userId.Value, investmentId, cancellationToken);
            if (!result.Success)
                return BadRequest(new { message = result.Error });

            return Ok(new
            {
                success = true,
                returnedAmount = result.ReturnedAmount,
                fee = result.Fee,
                message = $"Investment closed. ${result.ReturnedAmount:F2} returned (fee ${result.Fee:F2})"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Investment] Early exit error for {UserId}, inv {InvId}", userId, investmentId);
            return StatusCode(500, new { message = "Internal error. Try again." });
        }
    }

    private Guid? GetCurrentUserId()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
            return null;
        return userId;
    }
}
