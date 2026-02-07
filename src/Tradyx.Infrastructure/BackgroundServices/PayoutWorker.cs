using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Tradyx.Core.Interfaces;

namespace Tradyx.Infrastructure.BackgroundServices;

public class PayoutWorker : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<PayoutWorker> _logger;
    private readonly TimeSpan _interval = TimeSpan.FromSeconds(30);

    public PayoutWorker(IServiceProvider serviceProvider, ILogger<PayoutWorker> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogWarning("PayoutWorker STARTED — processing every {Seconds}s", _interval.TotalSeconds);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                _logger.LogInformation("[PayoutWorker] Checking for due investments at {Time}...", DateTime.UtcNow);

                using var scope = _serviceProvider.CreateScope();
                var payoutService = scope.ServiceProvider.GetRequiredService<IPayoutService>();
                var count = await payoutService.ProcessPayoutsAsync(stoppingToken);

                if (count > 0)
                    _logger.LogWarning("[PayoutWorker] Processed {Count} payouts", count);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[PayoutWorker] Error processing payouts");
            }

            await Task.Delay(_interval, stoppingToken);
        }
    }
}
