namespace Tradyx.Core.Interfaces;

public interface ITelegramNotifier
{
    Task NotifyAsync(string message, CancellationToken cancellationToken = default);
}
