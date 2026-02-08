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
    private readonly IWithdrawalService _withdrawalService;
    private readonly IConfiguration _configuration;
    private readonly ILogger<AdminController> _logger;

    public AdminController(
        IAdminRepository adminRepository, IPayoutService payoutService,
        IWithdrawalService withdrawalService,
        IConfiguration configuration, ILogger<AdminController> logger)
    {
        _adminRepository = adminRepository;
        _payoutService = payoutService;
        _withdrawalService = withdrawalService;
        _configuration = configuration;
        _logger = logger;
    }

    [HttpGet("stats")]
    public async Task<IActionResult> GetStats(CancellationToken cancellationToken)
    {
        if (!IsAdmin()) return Forbid();

        try
        {
            var stats = await _adminRepository.GetGlobalStatsAsync(cancellationToken);
            _logger.LogInformation("[Admin] Stats: Users={Users}, Invested=${Invested:F2}, Reserve=${Reserve:F2}",
                stats.TotalUsers, stats.TotalInvested, stats.SystemReserve);
            return Ok(stats);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Admin] Error fetching stats");
            return StatusCode(500, new { Message = "Failed to load statistics" });
        }
    }

    [HttpGet("all-users")]
    public async Task<IActionResult> GetAllUsers(CancellationToken cancellationToken)
    {
        if (!IsAdmin()) return Forbid();

        try
        {
            var users = await _adminRepository.GetAllUsersAsync(cancellationToken);
            return Ok(users);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Admin] Error fetching users");
            return StatusCode(500, new { Message = "Failed to load users" });
        }
    }

    [HttpGet("investments")]
    public async Task<IActionResult> GetRecentInvestments(
        [FromQuery] int limit = 20, CancellationToken cancellationToken = default)
    {
        if (!IsAdmin()) return Forbid();

        limit = Math.Min(Math.Max(1, limit), 100);

        try
        {
            var investments = await _adminRepository.GetRecentInvestmentsAsync(limit, cancellationToken);
            return Ok(investments);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Admin] Error fetching investments");
            return StatusCode(500, new { Message = "Failed to load investments" });
        }
    }

    [HttpGet("users/{userId:guid}/full-details")]
    public async Task<IActionResult> GetUserFullDetails(Guid userId, CancellationToken cancellationToken)
    {
        if (!IsAdmin()) return Forbid();

        try
        {
            var details = await _adminRepository.GetUserFullDetailsAsync(userId, cancellationToken);
            if (details == null) return NotFound(new { Message = "User not found" });
            return Ok(details);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Admin] Error fetching user details for {UserId}", userId);
            return StatusCode(500, new { Message = "Failed to load user details" });
        }
    }

    [HttpPost("users/{userId:guid}/adjust-balance")]
    public async Task<IActionResult> AdjustUserBalance(
        Guid userId, [FromBody] AdjustBalanceRequest request, CancellationToken cancellationToken)
    {
        if (!IsAdmin()) return Forbid();

        if (request.Amount == 0) return BadRequest(new { Message = "Amount cannot be zero" });

        try
        {
            _logger.LogWarning("[Admin] Adjusting balance for {UserId}: {Amount:+0.00;-0.00} — {Reason}",
                userId, request.Amount, request.Reason ?? "No reason");

            var success = await _adminRepository.AdjustUserBalanceAsync(
                userId, request.Amount, request.Reason ?? "Admin adjustment", cancellationToken);

            if (!success) return NotFound(new { Message = "User not found or balance would go negative" });

            return Ok(new { Message = $"Balance adjusted by {request.Amount:+0.00;-0.00}", UserId = userId, Amount = request.Amount });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Admin] Error adjusting balance for {UserId}", userId);
            return StatusCode(500, new { Message = "Failed to adjust balance" });
        }
    }

    [HttpPost("payouts/trigger")]
    public async Task<IActionResult> TriggerPayouts(CancellationToken cancellationToken)
    {
        if (!IsAdmin()) return Forbid();

        try
        {
            _logger.LogWarning("[Admin] Manual payout trigger");
            var processed = await _payoutService.ProcessPayoutsAsync(cancellationToken);
            _logger.LogWarning("[Admin] Payout complete: {Count} processed", processed);

            return Ok(new
            {
                Message = processed > 0 ? $"Processed {processed} payout(s)" : "No payouts were due",
                ProcessedCount = processed,
                TriggeredAt = DateTime.UtcNow
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Admin] Error triggering payouts");
            return StatusCode(500, new { Message = "Payout processing failed" });
        }
    }

    // === WITHDRAWAL QUEUE ===

    [HttpGet("withdrawals/pending")]
    public async Task<IActionResult> GetPendingWithdrawals(CancellationToken cancellationToken)
    {
        if (!IsAdmin()) return Forbid();

        try
        {
            var pending = await _withdrawalService.GetPendingWithdrawalsAsync(cancellationToken);
            return Ok(pending);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Admin] Error fetching pending withdrawals");
            return StatusCode(500, new { Message = "Failed to load pending withdrawals" });
        }
    }

    [HttpPost("withdrawals/{transactionId:guid}/approve")]
    public async Task<IActionResult> ApproveWithdrawal(Guid transactionId, CancellationToken cancellationToken)
    {
        if (!IsAdmin()) return Forbid();

        try
        {
            _logger.LogWarning("[Admin] Approving withdrawal {TxId}", transactionId);
            var (success, error) = await _withdrawalService.ApproveWithdrawalAsync(transactionId, cancellationToken);
            if (!success) return BadRequest(new { Message = error });
            return Ok(new { Message = "Withdrawal approved", TransactionId = transactionId });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Admin] Error approving withdrawal {TxId}", transactionId);
            return StatusCode(500, new { Message = "Failed to approve withdrawal" });
        }
    }

    [HttpPost("withdrawals/{transactionId:guid}/reject")]
    public async Task<IActionResult> RejectWithdrawal(
        Guid transactionId, [FromBody] RejectWithdrawalRequest? request, CancellationToken cancellationToken)
    {
        if (!IsAdmin()) return Forbid();

        try
        {
            _logger.LogWarning("[Admin] Rejecting withdrawal {TxId}: {Reason}", transactionId, request?.Reason ?? "N/A");
            var (success, error) = await _withdrawalService.RejectWithdrawalAsync(transactionId, request?.Reason, cancellationToken);
            if (!success) return BadRequest(new { Message = error });
            return Ok(new { Message = "Withdrawal rejected — funds refunded", TransactionId = transactionId });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Admin] Error rejecting withdrawal {TxId}", transactionId);
            return StatusCode(500, new { Message = "Failed to reject withdrawal" });
        }
    }

    private bool IsAdmin()
    {
        var userEmail = User.FindFirstValue(ClaimTypes.Email);
        var adminEmail = _configuration["AdminEmail"] ?? "admin@tradyx.com";
        var isAdmin = string.Equals(userEmail, adminEmail, StringComparison.OrdinalIgnoreCase);
        if (!isAdmin) _logger.LogWarning("[Admin] Access denied for {Email}", userEmail);
        return isAdmin;
    }
}

public record RejectWithdrawalRequest { public string? Reason { get; init; } }
