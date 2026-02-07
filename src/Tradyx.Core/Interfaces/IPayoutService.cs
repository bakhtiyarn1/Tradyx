namespace Tradyx.Core.Interfaces;

public interface IPayoutService
{
    Task<int> ProcessPayoutsAsync(CancellationToken cancellationToken = default);
}
