using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Tradyx.Core.Interfaces;

namespace Tradyx.Infrastructure.Services;

public class TelegramNotifierService : ITelegramNotifier
{
    private readonly HttpClient _http;
    private readonly string _botEndpoint;
    private readonly ILogger<TelegramNotifierService> _logger;

    public TelegramNotifierService(IConfiguration configuration, ILogger<TelegramNotifierService> logger)
    {
        _http = new HttpClient { Timeout = TimeSpan.FromSeconds(5) };
        _botEndpoint = configuration["Telegram:NotifyEndpoint"] ?? "http://localhost:3333/notify";
        _logger = logger;
    }

    public async Task NotifyAsync(string message, CancellationToken cancellationToken = default)
    {
        try
        {
            var payload = JsonSerializer.Serialize(new { message });
            var content = new StringContent(payload, Encoding.UTF8, "application/json");
            var response = await _http.PostAsync(_botEndpoint, content, cancellationToken);

            if (!response.IsSuccessStatusCode)
                _logger.LogWarning("[Telegram] Notify failed: {Status}", response.StatusCode);
        }
        catch (Exception ex)
        {
            // Non-critical — don't break the flow if bot is down
            _logger.LogWarning("[Telegram] Notify error (bot may be offline): {Message}", ex.Message);
        }
    }
}
