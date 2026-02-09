using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Tradyx.Core.Interfaces;

namespace Tradyx.Infrastructure.Services;

public class TelegramNotifierService : ITelegramNotifier
{
    private readonly HttpClient _http;
    private readonly List<string> _endpoints;
    private readonly ILogger<TelegramNotifierService> _logger;

    public TelegramNotifierService(IConfiguration configuration, ILogger<TelegramNotifierService> logger)
    {
        _http = new HttpClient { Timeout = TimeSpan.FromSeconds(5) };
        _logger = logger;

        // Support multiple notify endpoints (comma-separated)
        var endpointConfig = configuration["Telegram:NotifyEndpoint"] ?? "http://localhost:3334/notify";
        _endpoints = endpointConfig
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .ToList();

        _logger.LogInformation("[Telegram] Notify endpoints: {Endpoints}", string.Join(", ", _endpoints));
    }

    public async Task NotifyAsync(string message, CancellationToken cancellationToken = default)
    {
        var payload = JsonSerializer.Serialize(new { message });

        // Send to ALL endpoints in parallel
        var tasks = _endpoints.Select(endpoint => SendToEndpoint(endpoint, payload, cancellationToken));
        await Task.WhenAll(tasks);
    }

    private async Task SendToEndpoint(string endpoint, string payload, CancellationToken cancellationToken)
    {
        try
        {
            var content = new StringContent(payload, Encoding.UTF8, "application/json");
            var response = await _http.PostAsync(endpoint, content, cancellationToken);

            if (!response.IsSuccessStatusCode)
                _logger.LogWarning("[Telegram] Notify failed to {Endpoint}: {Status}", endpoint, response.StatusCode);
        }
        catch (Exception ex)
        {
            _logger.LogWarning("[Telegram] Notify error ({Endpoint}): {Message}", endpoint, ex.Message);
        }
    }
}
