using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Tradyx.Core.DTOs.Admin;
using Tradyx.Core.Interfaces;

namespace Tradyx.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
[Authorize]
public class AdminController : ControllerBase
{
    private readonly IAdminRepository _adminRepository;
    private readonly IPayoutService _payoutService;
    private readonly IConfiguration _configuration;
    private readonly ILogger<AdminController> _logger;

    public AdminController(
        IAdminRepository adminRepository,
        IPayoutService payoutService,
        IConfiguration configuration,
        ILogger<AdminController> logger)
    {
        _adminRepository = adminRepository;
        _payoutService = payoutService;
        _configuration = configuration;
        _logger = logger;
    }

    /// <summary>
    /// Gets global platform statistics. Admin only.
    /// </summary>
    /// <remarks>
    /// Returns aggregated statistics including:
    /// - Total users
    /// - Total invested amount
    /// - Total profit paid
    /// - Total referral bonuses
    /// - System reserve (financial health indicator)
    /// - Active investments count
    /// </remarks>
    [HttpGet("stats")]
    [ProducesResponseType(typeof(GlobalStatsResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetStats(CancellationToken cancellationToken)
    {
        if (!IsAdmin())
            return Forbid();

        _logger.LogInformation("[Admin] Fetching global stats at {Time}", DateTime.UtcNow);
        
        var stats = await _adminRepository.GetGlobalStatsAsync(cancellationToken);
        
        _logger.LogInformation(
            "[Admin] Stats: Users={Users}, Invested=${Invested:F2}, Profit=${Profit:F2}, Reserve=${Reserve:F2}",
            stats.TotalUsers, stats.TotalInvested, stats.TotalProfitPaid, stats.SystemReserve);
        
        return Ok(stats);
    }

    /// <summary>
    /// Gets all users. Admin only.
    /// </summary>
    [HttpGet("all-users")]
    [ProducesResponseType(typeof(IEnumerable<UserListItem>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetAllUsers(CancellationToken cancellationToken)
    {
        if (!IsAdmin())
            return Forbid();

        _logger.LogInformation("[Admin] Fetching all users");
        
        var users = await _adminRepository.GetAllUsersAsync(cancellationToken);
        
        return Ok(users);
    }

    /// <summary>
    /// Gets the most recent investments. Admin only.
    /// </summary>
    /// <param name="limit">Number of investments to return (default: 20, max: 100)</param>
    /// <param name="cancellationToken">Cancellation token</param>
    [HttpGet("investments")]
    [ProducesResponseType(typeof(IEnumerable<InvestmentInfoResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetRecentInvestments(
        [FromQuery] int limit = 20,
        CancellationToken cancellationToken = default)
    {
        if (!IsAdmin())
            return Forbid();

        // Cap the limit to prevent abuse
        limit = Math.Min(Math.Max(1, limit), 100);
        
        _logger.LogInformation("[Admin] Fetching last {Limit} investments", limit);
        
        var investments = await _adminRepository.GetRecentInvestmentsAsync(limit, cancellationToken);
        
        return Ok(investments);
    }

    /// <summary>
    /// Gets full details for a specific user. Admin only.
    /// </summary>
    [HttpGet("users/{userId:guid}/full-details")]
    [ProducesResponseType(typeof(UserFullDetailsResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetUserFullDetails(Guid userId, CancellationToken cancellationToken)
    {
        if (!IsAdmin())
            return Forbid();

        _logger.LogInformation("[Admin] Fetching full details for user {UserId}", userId);

        var details = await _adminRepository.GetUserFullDetailsAsync(userId, cancellationToken);
        
        if (details == null)
            return NotFound(new { Message = "User not found" });

        return Ok(details);
    }

    /// <summary>
    /// Adjusts user balance (can be positive or negative). Admin only.
    /// </summary>
    [HttpPost("users/{userId:guid}/adjust-balance")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AdjustUserBalance(
        Guid userId,
        [FromBody] AdjustBalanceRequest request,
        CancellationToken cancellationToken)
    {
        if (!IsAdmin())
            return Forbid();

        _logger.LogWarning("[Admin] Adjusting balance for user {UserId}: {Amount:+0.00;-0.00} - Reason: {Reason}",
            userId, request.Amount, request.Reason ?? "Not specified");

        var success = await _adminRepository.AdjustUserBalanceAsync(
            userId, request.Amount, request.Reason ?? "Admin adjustment", cancellationToken);

        if (!success)
            return NotFound(new { Message = "User not found" });

        return Ok(new 
        { 
            Message = $"Balance adjusted by {request.Amount:+0.00;-0.00}",
            UserId = userId,
            Amount = request.Amount
        });
    }

    /// <summary>
    /// Triggers payout processing immediately. Admin only.
    /// </summary>
    [HttpPost("payouts/trigger")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> TriggerPayouts(CancellationToken cancellationToken)
    {
        if (!IsAdmin())
            return Forbid();

        _logger.LogWarning("[Admin] Manual payout trigger initiated by admin");

        var processed = await _payoutService.ProcessPayoutsAsync(cancellationToken);

        _logger.LogWarning("[Admin] Manual payout completed: {Count} payouts processed", processed);

        return Ok(new
        {
            Message = processed > 0 
                ? $"Processed {processed} payout(s)" 
                : "No payouts were due",
            ProcessedCount = processed,
            TriggeredAt = DateTime.UtcNow
        });
    }

    /// <summary>
    /// Checks if current user is an admin based on email.
    /// </summary>
    private bool IsAdmin()
    {
        var userEmail = User.FindFirstValue(ClaimTypes.Email);
        var adminEmail = _configuration["AdminEmail"] ?? "admin@tradyx.com";
        
        var isAdmin = string.Equals(userEmail, adminEmail, StringComparison.OrdinalIgnoreCase);
        
        if (!isAdmin)
        {
            _logger.LogWarning("[Admin] Access denied for user {Email}", userEmail);
        }
        
        return isAdmin;
    }
}
