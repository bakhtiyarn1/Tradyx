using Tradyx.Core.DTOs;
using Tradyx.Core.Entities;

namespace Tradyx.Core.Interfaces;

public interface IInvestmentService
{
    Task<InvestmentResponse> PurchaseAsync(Guid userId, decimal amount, CancellationToken cancellationToken = default);
    Task<IEnumerable<InvestmentResponse>> GetUserInvestmentsAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<IEnumerable<InvestmentPlan>> GetActivePlansAsync(CancellationToken cancellationToken = default);
}
