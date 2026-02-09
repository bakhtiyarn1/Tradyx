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
    private readonly IWithdrawalService _withdrawalService;
    private readonly ITreasuryService _treasuryService;
    private readonly IRealtimeNotifier _realtime;
    private readonly ITelegramNotifier _telegram;
    private readonly ILogger<UserController> _logger;

    public UserController(
        IUserRepository userRepository,
        ITransactionRepository transactionRepository,
        INotificationRepository notificationRepository,
        IReferralService referralService,
        IRankService rankService,
        IWithdrawalService withdrawalService,
        ITreasuryService treasuryService,
        IRealtimeNotifier realtime,
        ITelegramNotifier telegram,
        ILogger<UserController> logger)
    {
        _userRepository = userRepository;
        _transactionRepository = transactionRepository;
        _notificationRepository = notificationRepository;
        _referralService = referralService;
        _rankService = rankService;
        _withdrawalService = withdrawalService;
        _treasuryService = treasuryService;
        _realtime = realtime;
        _telegram = telegram;
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
                Description = t.Description, Status = t.Status,
                FeeAmount = t.FeeAmount, IsInstant = t.IsInstant,
                CreatedAt = t.CreatedAt
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
            // DepositAsync now handles insurance deduction internally
            var success = await _userRepository.DepositWithInsuranceAsync(
                userId.Value, request.Amount, _treasuryService, cancellationToken);
            if (!success.Success) return BadRequest(new { Message = success.Error ?? "Deposit failed — user not found" });

            _logger.LogInformation("[Deposit] User {UserId} deposited ${Gross:F2} (net ${Net:F2}, insurance ${Fee:F2})",
                userId, request.Amount, success.NetAmount, success.InsuranceFee);

            // Real-time: push new balance + events to connected client
            var grossAmount = request.Amount;
            _ = Task.Run(async () =>
            {
                try
                {
                    var user = await _userRepository.GetByIdAsync(userId.Value);
                    if (user != null)
                    {
                        await _realtime.NotifyBalanceUpdated(userId.Value, user.Balance);
                        await _realtime.NotifyTransactionCreated(userId.Value, "Deposit", grossAmount);
                        await _realtime.NotifyNewNotification(userId.Value, $"💳 Deposit ${grossAmount:F2} credited (${success.InsuranceFee:F2} → insurance fund)");

                        // Telegram admin notification
                        await _telegram.NotifyAsync(
                            $"💳 <b>Новый депозит</b>\n\n" +
                            $"👤 Пользователь: <code>{user.Username}</code>\n" +
                            $"💰 Сумма: <b>+${grossAmount:F2}</b>\n" +
                            $"🛡 Страховой фонд: <b>${success.InsuranceFee:F2}</b>\n" +
                            $"💼 Баланс: <b>${user.Balance:F2}</b>");
                    }
                }
                catch { /* non-critical — don't fail the HTTP response */ }
            });

            return Ok(new
            {
                Message = $"Successfully deposited ${request.Amount:F2} (${success.InsuranceFee:F2} allocated to insurance fund)",
                Amount = request.Amount,
                NetAmount = success.NetAmount,
                InsuranceFee = success.InsuranceFee
            });
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

        try
        {
            // === COOLING PERIOD CHECK ===
            var cooling = await _treasuryService.CheckCoolingPeriodAsync(userId.Value, cancellationToken);
            if (!cooling.Allowed)
                return BadRequest(new { Message = cooling.Error, CoolingHoursLeft = cooling.HoursRemaining, CoolingUnlocksAt = cooling.UnlocksAt });

            // === DAILY LIMIT CHECK (platform + personal) ===
            var limitCheck = await _treasuryService.CheckDailyWithdrawalLimitAsync(userId.Value, request.Amount, cancellationToken);
            if (!limitCheck.Allowed)
                return BadRequest(new { Message = limitCheck.Error, PlatformUsedToday = limitCheck.PlatformUsedToday, PersonalLimit = limitCheck.PersonalLimit });

            var result = await _withdrawalService.RequestWithdrawalAsync(
                userId.Value, request.Amount, request.IsInstant, request.WalletAddress, cancellationToken);

            if (!result.Success)
                return BadRequest(new { Message = result.Error });

            _logger.LogInformation("[Withdraw] User {UserId}: ${Amount:F2}, instant={Instant}, status={Status}",
                userId, request.Amount, request.IsInstant, result.Status);

            return Ok(new
            {
                Message = result.Status == "Completed"
                    ? $"Instant withdrawal ${result.NetAmount:F2} completed (fee ${result.Fee:F2})"
                    : $"Withdrawal ${result.NetAmount:F2} submitted — awaiting admin approval",
                result.TransactionId,
                result.NetAmount,
                result.Fee,
                result.Status
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Withdraw] Error for user {UserId}, amount ${Amount:F2}", userId, request.Amount);
            return StatusCode(500, new { Message = "Withdrawal failed due to an internal error" });
        }
    }

    [HttpGet("me/withdrawal-info")]
    public async Task<IActionResult> GetWithdrawalInfo(CancellationToken cancellationToken)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized(new { Message = "Invalid token" });

        try
        {
            var user = await _userRepository.GetByIdAsync(userId.Value, cancellationToken);
            if (user == null) return NotFound(new { Message = "User not found" });

            var info = _withdrawalService.GetWithdrawalInfo(user.Status);
            return Ok(info);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Withdraw] Error getting withdrawal info for {UserId}", userId);
            return StatusCode(500, new { Message = "Failed to load withdrawal info" });
        }
    }

    [HttpGet("me/withdrawal-limits")]
    public async Task<IActionResult> GetWithdrawalLimits(CancellationToken cancellationToken)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized(new { Message = "Invalid token" });

        try
        {
            var user = await _userRepository.GetByIdAsync(userId.Value, cancellationToken);
            if (user == null) return NotFound(new { Message = "User not found" });

            var cooling = await _treasuryService.CheckCoolingPeriodAsync(userId.Value, cancellationToken);
            var dailyLimit = await _treasuryService.CheckDailyWithdrawalLimitAsync(userId.Value, 0, cancellationToken);
            var personalLimit = _treasuryService.GetPersonalDailyLimit(user.Status);

            return Ok(new
            {
                CoolingPeriod = new
                {
                    cooling.Allowed,
                    cooling.HoursRemaining,
                    cooling.UnlocksAt
                },
                DailyLimits = new
                {
                    PersonalLimit = personalLimit,
                    PersonalUsedToday = dailyLimit.PersonalUsedToday,
                    PersonalRemaining = Math.Max(0, personalLimit - dailyLimit.PersonalUsedToday),
                    PlatformUsedToday = dailyLimit.PlatformUsedToday,
                    PlatformLimit = dailyLimit.PlatformLimit,
                    PlatformRemaining = Math.Max(0, dailyLimit.PlatformLimit - dailyLimit.PlatformUsedToday)
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[User] Error getting withdrawal limits for {UserId}", userId);
            return StatusCode(500, new { Message = "Failed to load withdrawal limits" });
        }
    }

    [HttpGet("me/referral-qualification")]
    public async Task<IActionResult> GetReferralQualification(CancellationToken cancellationToken)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized(new { Message = "Invalid token" });

        try
        {
            var qual = await _withdrawalService.GetReferralQualificationAsync(userId.Value, cancellationToken);
            return Ok(qual);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[User] Error getting referral qualification for {UserId}", userId);
            return StatusCode(500, new { Message = "Failed to load referral qualification" });
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
public record TransactionResponse { public Guid Id { get; init; } public decimal Amount { get; init; } public string Type { get; init; } = string.Empty; public string Description { get; init; } = string.Empty; public string Status { get; init; } = "Completed"; public decimal FeeAmount { get; init; } public bool IsInstant { get; init; } public DateTime CreatedAt { get; init; } }
public record NotificationsResponse { public int UnreadCount { get; init; } public List<NotificationDto> Notifications { get; init; } = new(); }
public record NotificationDto { public Guid Id { get; init; } public string Message { get; init; } = string.Empty; public bool IsRead { get; init; } public DateTime CreatedAt { get; init; } }
