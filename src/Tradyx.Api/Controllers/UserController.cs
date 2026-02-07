using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Tradyx.Core.DTOs.User;
using Tradyx.Core.Entities;
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
    private readonly ILogger<UserController> _logger;

    public UserController(
        IUserRepository userRepository,
        ITransactionRepository transactionRepository,
        INotificationRepository notificationRepository,
        ILogger<UserController> logger)
    {
        _userRepository = userRepository;
        _transactionRepository = transactionRepository;
        _notificationRepository = notificationRepository;
        _logger = logger;
    }

    /// <summary>
    /// Gets current user's profile (from JWT token).
    /// </summary>
    [HttpGet("me")]
    [ProducesResponseType(typeof(UserProfileResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetMyProfile(CancellationToken cancellationToken)
    {
        var userId = GetCurrentUserId();
        if (userId == null)
            return Unauthorized(new { Message = "Invalid token" });

        var user = await _userRepository.GetByIdAsync(userId.Value, cancellationToken);
        if (user == null)
            return NotFound(new { Message = "User not found" });

        return Ok(new UserProfileResponse
        {
            Id = user.Id,
            Username = user.Username,
            Email = user.Email,
            Balance = user.Balance,
            CreatedAt = user.CreatedAt
        });
    }

    /// <summary>
    /// Gets current user's transaction history.
    /// </summary>
    [HttpGet("me/transactions")]
    [ProducesResponseType(typeof(IEnumerable<TransactionResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMyTransactions(
        [FromQuery] int skip = 0,
        [FromQuery] int take = 50,
        CancellationToken cancellationToken = default)
    {
        var userId = GetCurrentUserId();
        if (userId == null)
            return Unauthorized(new { Message = "Invalid token" });

        var transactions = await _transactionRepository.GetByUserIdAsync(userId.Value, skip, take, cancellationToken);

        var response = transactions.Select(t => new TransactionResponse
        {
            Id = t.Id,
            Amount = t.Amount,
            Type = t.Type,
            Description = t.Description,
            CreatedAt = t.CreatedAt
        });

        return Ok(response);
    }

    /// <summary>
    /// Gets current user's dashboard (from JWT token).
    /// </summary>
    /// <remarks>
    /// Returns aggregated data including:
    /// - Current balance
    /// - Active investments summary
    /// - Total and today's earnings
    /// - Referral statistics
    /// - Next payout time
    /// </remarks>
    [HttpGet("me/dashboard")]
    [ProducesResponseType(typeof(UserDashboardResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetMyDashboard(CancellationToken cancellationToken)
    {
        var userId = GetCurrentUserId();
        if (userId == null)
            return Unauthorized(new { Message = "Invalid token" });

        _logger.LogInformation("[Dashboard] Fetching dashboard for user {UserId}", userId);

        var dashboard = await _userRepository.GetDashboardAsync(userId.Value, cancellationToken);
        
        if (dashboard == null)
            return NotFound(new { Message = "User not found" });

        _logger.LogInformation(
            "[Dashboard] User {UserId}: Balance=${Balance:F2}, TotalEarned=${TotalEarned:F2}, TodayProfit=${TodayProfit:F2}",
            userId, dashboard.Balance, dashboard.TotalEarned, dashboard.TodayProfit);

        return Ok(dashboard);
    }

    /// <summary>
    /// Gets current user's notifications.
    /// </summary>
    [HttpGet("me/notifications")]
    [ProducesResponseType(typeof(NotificationsResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMyNotifications(
        [FromQuery] int limit = 20,
        CancellationToken cancellationToken = default)
    {
        var userId = GetCurrentUserId();
        if (userId == null)
            return Unauthorized(new { Message = "Invalid token" });

        limit = Math.Min(Math.Max(1, limit), 50);

        var notifications = await _notificationRepository.GetUserNotificationsAsync(userId.Value, limit, cancellationToken);
        var unreadCount = await _notificationRepository.GetUnreadCountAsync(userId.Value, cancellationToken);

        return Ok(new NotificationsResponse
        {
            UnreadCount = unreadCount,
            Notifications = notifications.Select(n => new NotificationDto
            {
                Id = n.Id,
                Message = n.Message,
                IsRead = n.IsRead,
                CreatedAt = n.CreatedAt
            }).ToList()
        });
    }

    /// <summary>
    /// Marks a notification as read.
    /// </summary>
    [HttpPatch("me/notifications/{notificationId:guid}/read")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> MarkNotificationAsRead(Guid notificationId, CancellationToken cancellationToken)
    {
        var userId = GetCurrentUserId();
        if (userId == null)
            return Unauthorized(new { Message = "Invalid token" });

        var success = await _notificationRepository.MarkAsReadAsync(notificationId, userId.Value, cancellationToken);
        
        if (!success)
            return NotFound(new { Message = "Notification not found" });

        return Ok(new { Message = "Notification marked as read" });
    }

    /// <summary>
    /// Marks all notifications as read.
    /// </summary>
    [HttpPatch("me/notifications/read-all")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> MarkAllNotificationsAsRead(CancellationToken cancellationToken)
    {
        var userId = GetCurrentUserId();
        if (userId == null)
            return Unauthorized(new { Message = "Invalid token" });

        await _notificationRepository.MarkAllAsReadAsync(userId.Value, cancellationToken);
        
        return Ok(new { Message = "All notifications marked as read" });
    }

    /// <summary>
    /// Deposits funds to current user's balance.
    /// </summary>
    [HttpPost("me/deposit")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Deposit(
        [FromBody] Tradyx.Core.DTOs.DepositRequest request,
        CancellationToken cancellationToken)
    {
        var userId = GetCurrentUserId();
        if (userId == null)
            return Unauthorized(new { Message = "Invalid token" });

        if (!ModelState.IsValid)
        {
            var errors = ModelState.Values.SelectMany(v => v.Errors).Select(e => e.ErrorMessage).ToList();
            return BadRequest(new { Message = string.Join(" ", errors) });
        }

        if (request.Amount <= 0)
            return BadRequest(new { Message = "Amount must be positive" });

        var success = await _userRepository.DepositAsync(userId.Value, request.Amount, cancellationToken);
        if (!success)
            return BadRequest(new { Message = "Deposit failed" });

        _logger.LogInformation("[Deposit] User {UserId} deposited ${Amount:F2}", userId, request.Amount);

        return Ok(new { Message = $"Successfully deposited ${request.Amount:F2}", Amount = request.Amount });
    }

    /// <summary>
    /// Withdraws funds from current user's balance.
    /// </summary>
    [HttpPost("me/withdraw")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Withdraw(
        [FromBody] Tradyx.Core.DTOs.WithdrawalRequest request,
        CancellationToken cancellationToken)
    {
        var userId = GetCurrentUserId();
        if (userId == null)
            return Unauthorized(new { Message = "Invalid token" });

        if (!ModelState.IsValid)
        {
            var errors = ModelState.Values.SelectMany(v => v.Errors).Select(e => e.ErrorMessage).ToList();
            return BadRequest(new { Message = string.Join(" ", errors) });
        }

        if (request.Amount < 10)
            return BadRequest(new { Message = "Minimum withdrawal is $10" });

        var (success, error) = await _userRepository.WithdrawAsync(userId.Value, request.Amount, request.WalletAddress, cancellationToken);
        if (!success)
            return BadRequest(new { Message = error ?? "Withdrawal failed" });

        _logger.LogInformation("[Withdraw] User {UserId} withdrew ${Amount:F2}", userId, request.Amount);

        return Ok(new { Message = $"Successfully withdrew ${request.Amount:F2}", Amount = request.Amount });
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

public record UserProfileResponse
{
    public Guid Id { get; init; }
    public string Username { get; init; } = string.Empty;
    public string Email { get; init; } = string.Empty;
    public decimal Balance { get; init; }
    public DateTime CreatedAt { get; init; }
}

public record TransactionResponse
{
    public Guid Id { get; init; }
    public decimal Amount { get; init; }
    public string Type { get; init; } = string.Empty;
    public string Description { get; init; } = string.Empty;
    public DateTime CreatedAt { get; init; }
}

public record NotificationsResponse
{
    public int UnreadCount { get; init; }
    public List<NotificationDto> Notifications { get; init; } = new();
}

public record NotificationDto
{
    public Guid Id { get; init; }
    public string Message { get; init; } = string.Empty;
    public bool IsRead { get; init; }
    public DateTime CreatedAt { get; init; }
}
