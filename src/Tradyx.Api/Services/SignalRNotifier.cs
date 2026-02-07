using Microsoft.AspNetCore.SignalR;
using Tradyx.Api.Hubs;
using Tradyx.Core.Interfaces;

namespace Tradyx.Api.Services;

/// <summary>
/// Sends real-time events to connected users via SignalR.
/// Injected as IRealtimeNotifier anywhere in the system.
/// </summary>
public class SignalRNotifier : IRealtimeNotifier
{
    private readonly IHubContext<NotificationHub, IRealtimeClient> _hub;
    private readonly ILogger<SignalRNotifier> _logger;

    public SignalRNotifier(
        IHubContext<NotificationHub, IRealtimeClient> hub,
        ILogger<SignalRNotifier> logger)
    {
        _hub = hub;
        _logger = logger;
    }

    public async Task NotifyBalanceUpdated(Guid userId, decimal newBalance)
    {
        _logger.LogDebug("[SignalR] BalanceUpdated -> {UserId}: ${Balance:F2}", userId, newBalance);
        await _hub.Clients.User(userId.ToString()).BalanceUpdated(newBalance);
    }

    public async Task NotifyPayoutReceived(Guid userId, decimal amount, string description)
    {
        _logger.LogDebug("[SignalR] PayoutReceived -> {UserId}: +${Amount:F2}", userId, amount);
        await _hub.Clients.User(userId.ToString()).PayoutReceived(amount, description);
    }

    public async Task NotifyNewNotification(Guid userId, string message)
    {
        await _hub.Clients.User(userId.ToString()).NotificationReceived(message);
    }

    public async Task NotifyInvestmentUpdated(Guid userId)
    {
        await _hub.Clients.User(userId.ToString()).InvestmentUpdated();
    }

    public async Task NotifyTransactionCreated(Guid userId, string type, decimal amount)
    {
        await _hub.Clients.User(userId.ToString()).TransactionCreated(type, amount);
    }
}
