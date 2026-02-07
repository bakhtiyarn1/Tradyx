using Tradyx.Core.DTOs;

namespace Tradyx.Core.Interfaces;

public interface IInvestmentService
{
    Task<InvestmentResponse> PurchaseAsync(Guid userId, decimal amount, CancellationToken cancellationToken = default);
    Task<IEnumerable<InvestmentResponse>> GetUserInvestmentsAsync(Guid userId, CancellationToken cancellationToken = default);
}
