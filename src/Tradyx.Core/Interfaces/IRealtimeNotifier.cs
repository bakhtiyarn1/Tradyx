namespace Tradyx.Core.Interfaces;

/// <summary>
/// Abstraction for pushing real-time events to connected users.
/// Implemented via SignalR in the API layer.
/// </summary>
public interface IRealtimeNotifier
{
    Task NotifyBalanceUpdated(Guid userId, decimal newBalance);
    Task NotifyPayoutReceived(Guid userId, decimal amount, string description);
    Task NotifyNewNotification(Guid userId, string message);
    Task NotifyInvestmentUpdated(Guid userId);
    Task NotifyTransactionCreated(Guid userId, string type, decimal amount);
}
