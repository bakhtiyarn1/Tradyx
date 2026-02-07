namespace Tradyx.Core.Interfaces;

/// <summary>
/// Strongly-typed SignalR client methods.
/// Every method here becomes an event the frontend can subscribe to.
/// </summary>
public interface IRealtimeClient
{
    Task BalanceUpdated(decimal newBalance);
    Task PayoutReceived(decimal amount, string description);
    Task NotificationReceived(string message);
    Task InvestmentUpdated();
    Task TransactionCreated(string type, decimal amount);

    /// <summary>User's rank was promoted.</summary>
    Task StatusUpgraded(int oldRank, int newRank, string newRankName);
}
