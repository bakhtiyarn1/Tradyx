using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Tradyx.Core.DTOs.User;
using Tradyx.Core.Interfaces;

namespace Tradyx.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
[Authorize]
public class UserController : ControllerBase
{
    private readonly IUserRepository _userRepository;
    private readonly ITransactionRepository _transactionRepository;
    private readonly INotificationRepository _notificationRepository;
    private readonly IReferralService _referralService;
    private readonly IRankService _rankService;
    private readonly IRealtimeNotifier _realtime;
    private readonly ILogger<UserController> _logger;

    public UserController(
        IUserRepository userRepository,
        ITransactionRepository transactionRepository,
        INotificationRepository notificationRepository,
        IReferralService referralService,
        IRankService rankService,
        IRealtimeNotifier realtime,
        ILogger<UserController> logger)
    {
        _userRepository = userRepository;
        _transactionRepository = transactionRepository;
        _notificationRepository = notificationRepository;
        _referralService = referralService;
        _rankService = rankService;
        _realtime = realtime;
        _logger = logger;
    }

    [HttpGet("me")]
    public async Task<IActionResult> GetMyProfile(CancellationToken cancellationToken)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized(new { Message = "Invalid token" });

        try
        {
            var user = await _userRepository.GetByIdAsync(userId.Value, cancellationToken);
            if (user == null) return NotFound(new { Message = "User not found" });

            return Ok(new UserProfileResponse
            {
                Id = user.Id, Username = user.Username, Email = user.Email,
                Balance = user.Balance, InviteCode = user.InviteCode, CreatedAt = user.CreatedAt
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[User] Error fetching profile for {UserId}", userId);
            return StatusCode(500, new { Message = "Failed to load profile" });
        }
    }

    [HttpGet("me/transactions")]
    public async Task<IActionResult> GetMyTransactions(
        [FromQuery] int skip = 0, [FromQuery] int take = 50,
        CancellationToken cancellationToken = default)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized(new { Message = "Invalid token" });

        skip = Math.Max(0, skip);
        take = Math.Min(Math.Max(1, take), 200);

        try
        {
            var transactions = await _transactionRepository.GetByUserIdAsync(userId.Value, skip, take, cancellationToken);
            var response = transactions.Select(t => new TransactionResponse
            {
                Id = t.Id, Amount = t.Amount, Type = t.Type,
                Description = t.Description, CreatedAt = t.CreatedAt
            });
            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[User] Error fetching transactions for {UserId}", userId);
            return StatusCode(500, new { Message = "Failed to load transactions" });
        }
    }

    [HttpGet("me/dashboard")]
    public async Task<IActionResult> GetMyDashboard(CancellationToken cancellationToken)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized(new { Message = "Invalid token" });

        try
        {
            var dashboard = await _userRepository.GetDashboardAsync(userId.Value, cancellationToken);
            if (dashboard == null) return NotFound(new { Message = "User not found" });

            // Enrich with rank progress
            var rankProgress = await _rankService.GetRankProgressAsync(userId.Value, cancellationToken);
            var enriched = dashboard with { RankProgress = rankProgress };

            return Ok(enriched);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[User] Error fetching dashboard for {UserId}", userId);
            return StatusCode(500, new { Message = "Failed to load dashboard" });
        }
    }

    [HttpGet("me/notifications")]
    public async Task<IActionResult> GetMyNotifications(
        [FromQuery] int limit = 20, CancellationToken cancellationToken = default)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized(new { Message = "Invalid token" });

        limit = Math.Min(Math.Max(1, limit), 50);

        try
        {
            var notifications = await _notificationRepository.GetUserNotificationsAsync(userId.Value, limit, cancellationToken);
            var unreadCount = await _notificationRepository.GetUnreadCountAsync(userId.Value, cancellationToken);

            return Ok(new NotificationsResponse
            {
                UnreadCount = unreadCount,
                Notifications = notifications.Select(n => new NotificationDto
                {
                    Id = n.Id, Message = n.Message, IsRead = n.IsRead, CreatedAt = n.CreatedAt
                }).ToList()
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[User] Error fetching notifications for {UserId}", userId);
            return StatusCode(500, new { Message = "Failed to load notifications" });
        }
    }

    [HttpPatch("me/notifications/{notificationId:guid}/read")]
    public async Task<IActionResult> MarkNotificationAsRead(Guid notificationId, CancellationToken cancellationToken)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized(new { Message = "Invalid token" });

        try
        {
            var success = await _notificationRepository.MarkAsReadAsync(notificationId, userId.Value, cancellationToken);
            if (!success) return NotFound(new { Message = "Notification not found" });
            return Ok(new { Message = "Notification marked as read" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[User] Error marking notification {NotifId} for {UserId}", notificationId, userId);
            return StatusCode(500, new { Message = "Failed to update notification" });
        }
    }

    [HttpPatch("me/notifications/read-all")]
    public async Task<IActionResult> MarkAllNotificationsAsRead(CancellationToken cancellationToken)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized(new { Message = "Invalid token" });

        try
        {
            await _notificationRepository.MarkAllAsReadAsync(userId.Value, cancellationToken);
            return Ok(new { Message = "All notifications marked as read" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[User] Error marking all notifications for {UserId}", userId);
            return StatusCode(500, new { Message = "Failed to update notifications" });
        }
    }

    [HttpPost("me/deposit")]
    public async Task<IActionResult> Deposit(
        [FromBody] Tradyx.Core.DTOs.DepositRequest request, CancellationToken cancellationToken)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized(new { Message = "Invalid token" });

        if (!ModelState.IsValid)
        {
            var errors = ModelState.Values.SelectMany(v => v.Errors).Select(e => e.ErrorMessage).ToList();
            return BadRequest(new { Message = string.Join(" ", errors) });
        }
        if (request.Amount <= 0) return BadRequest(new { Message = "Amount must be positive" });

        try
        {
            var success = await _userRepository.DepositAsync(userId.Value, request.Amount, cancellationToken);
            if (!success) return BadRequest(new { Message = "Deposit failed — user not found" });

            _logger.LogInformation("[Deposit] User {UserId} deposited ${Amount:F2}", userId, request.Amount);

            // Real-time: push new balance + events to connected client
            _ = Task.Run(async () =>
            {
                try
                {
                    var user = await _userRepository.GetByIdAsync(userId.Value);
                    if (user != null)
                    {
                        await _realtime.NotifyBalanceUpdated(userId.Value, user.Balance);
                        await _realtime.NotifyTransactionCreated(userId.Value, "Deposit", request.Amount);
                        await _realtime.NotifyNewNotification(userId.Value, $"💳 Deposit ${request.Amount:F2} credited");
                    }
                }
                catch { /* non-critical — don't fail the HTTP response */ }
            });

            return Ok(new { Message = $"Successfully deposited ${request.Amount:F2}", Amount = request.Amount });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Deposit] Error for user {UserId}, amount ${Amount:F2}", userId, request.Amount);
            return StatusCode(500, new { Message = "Deposit failed due to an internal error" });
        }
    }

    [HttpPost("me/withdraw")]
    public async Task<IActionResult> Withdraw(
        [FromBody] Tradyx.Core.DTOs.WithdrawalRequest request, CancellationToken cancellationToken)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized(new { Message = "Invalid token" });

        if (!ModelState.IsValid)
        {
            var errors = ModelState.Values.SelectMany(v => v.Errors).Select(e => e.ErrorMessage).ToList();
            return BadRequest(new { Message = string.Join(" ", errors) });
        }
        if (request.Amount < 10) return BadRequest(new { Message = "Minimum withdrawal is $10" });

        try
        {
            var (success, error) = await _userRepository.WithdrawAsync(userId.Value, request.Amount, request.WalletAddress, cancellationToken);
            if (!success) return BadRequest(new { Message = error ?? "Withdrawal failed" });

            _logger.LogInformation("[Withdraw] User {UserId} withdrew ${Amount:F2}", userId, request.Amount);

            // Real-time: push new balance + events
            _ = Task.Run(async () =>
            {
                try
                {
                    var user = await _userRepository.GetByIdAsync(userId.Value);
                    if (user != null)
                    {
                        await _realtime.NotifyBalanceUpdated(userId.Value, user.Balance);
                        await _realtime.NotifyTransactionCreated(userId.Value, "Withdrawal", -request.Amount);
                        await _realtime.NotifyNewNotification(userId.Value, $"💸 Withdrawal ${request.Amount:F2} processed");
                    }
                }
                catch { /* non-critical */ }
            });

            return Ok(new { Message = $"Successfully withdrew ${request.Amount:F2}", Amount = request.Amount });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Withdraw] Error for user {UserId}, amount ${Amount:F2}", userId, request.Amount);
            return StatusCode(500, new { Message = "Withdrawal failed due to an internal error" });
        }
    }

    [HttpGet("me/team")]
    public async Task<IActionResult> GetMyTeam(CancellationToken cancellationToken)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized(new { Message = "Invalid token" });

        try
        {
            var team = await _referralService.GetMyTeamAsync(userId.Value, cancellationToken);
            return Ok(team);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[User] Error fetching team for {UserId}", userId);
            return StatusCode(500, new { Message = "Failed to load team" });
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

public record UserProfileResponse { public Guid Id { get; init; } public string Username { get; init; } = string.Empty; public string Email { get; init; } = string.Empty; public decimal Balance { get; init; } public string InviteCode { get; init; } = string.Empty; public DateTime CreatedAt { get; init; } }
public record TransactionResponse { public Guid Id { get; init; } public decimal Amount { get; init; } public string Type { get; init; } = string.Empty; public string Description { get; init; } = string.Empty; public DateTime CreatedAt { get; init; } }
public record NotificationsResponse { public int UnreadCount { get; init; } public List<NotificationDto> Notifications { get; init; } = new(); }
public record NotificationDto { public Guid Id { get; init; } public string Message { get; init; } = string.Empty; public bool IsRead { get; init; } public DateTime CreatedAt { get; init; } }
