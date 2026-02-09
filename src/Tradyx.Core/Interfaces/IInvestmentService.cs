using Tradyx.Core.DTOs;
using Tradyx.Core.Entities;

namespace Tradyx.Core.Interfaces;

public interface IInvestmentService
{
    Task<InvestmentResponse> PurchaseAsync(Guid userId, decimal amount, CancellationToken cancellationToken = default);
    Task<IEnumerable<InvestmentResponse>> GetUserInvestmentsAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<IEnumerable<InvestmentPlan>> GetActivePlansAsync(CancellationToken cancellationToken = default);

    /// <summary>Early exit: return investment body minus fee after min lock period.</summary>
    Task<EarlyExitResult> RequestEarlyExitAsync(Guid userId, Guid investmentId, CancellationToken cancellationToken = default);
}

public record EarlyExitResult(bool Success, string? Error = null, decimal ReturnedAmount = 0, decimal Fee = 0);
