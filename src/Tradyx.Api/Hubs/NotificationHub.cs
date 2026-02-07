using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Tradyx.Core.Interfaces;

namespace Tradyx.Api.Hubs;

/// <summary>
/// SignalR hub for real-time notifications.
/// Strongly typed via IRealtimeClient — no magic strings.
/// UserIdentifier is resolved from ClaimTypes.NameIdentifier (= user GUID).
/// </summary>
[Authorize]
public class NotificationHub : Hub<IRealtimeClient>
{
    private readonly ILogger<NotificationHub> _logger;

    public NotificationHub(ILogger<NotificationHub> logger)
    {
        _logger = logger;
    }

    public override Task OnConnectedAsync()
    {
        _logger.LogInformation("[SignalR] User {UserId} connected (conn={ConnId})",
            Context.UserIdentifier, Context.ConnectionId);
        return base.OnConnectedAsync();
    }

    public override Task OnDisconnectedAsync(Exception? exception)
    {
        _logger.LogInformation("[SignalR] User {UserId} disconnected (conn={ConnId})",
            Context.UserIdentifier, Context.ConnectionId);
        return base.OnDisconnectedAsync(exception);
    }
}
