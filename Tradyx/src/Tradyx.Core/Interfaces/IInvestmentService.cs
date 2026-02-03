using Tradyx.Core.DTOs;

namespace Tradyx.Core.Interfaces;

/// <summary>
/// Service interface for investment operations.
/// </summary>
public interface IInvestmentService
{
    /// <summary>
    /// Purchases a new investment for a user.
    /// </summary>
    Task<InvestmentResponse> PurchaseAsync(Guid userId, decimal amount, CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets all investments for a user.
    /// </summary>
    Task<IEnumerable<InvestmentResponse>> GetUserInvestmentsAsync(Guid userId, CancellationToken cancellationToken = default);
}
