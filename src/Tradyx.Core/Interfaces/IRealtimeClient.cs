namespace Tradyx.Core.Interfaces;

/// <summary>
/// Strongly-typed SignalR client methods.
/// Every method here becomes an event the frontend can subscribe to.
/// </summary>
public interface IRealtimeClient
{
    /// <summary>User's balance has changed.</summary>
    Task BalanceUpdated(decimal newBalance);

    /// <summary>A payout was credited to the user.</summary>
    Task PayoutReceived(decimal amount, string description);

    /// <summary>A new notification was created for the user.</summary>
    Task NotificationReceived(string message);

    /// <summary>User's investment list changed — frontend should refetch.</summary>
    Task InvestmentUpdated();

    /// <summary>A transaction was recorded — frontend should refetch.</summary>
    Task TransactionCreated(string type, decimal amount);
}
