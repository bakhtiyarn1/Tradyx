using System.Data;
using Tradyx.Core.Entities;

namespace Tradyx.Core.Interfaces;

public interface IInvestmentRepository
{
    Task<IEnumerable<Investment>> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<IEnumerable<Investment>> GetDueForPayoutAsync(CancellationToken cancellationToken = default);
    Task AddAsync(Investment investment, IDbConnection connection, IDbTransaction transaction);
    Task UpdateNextPayoutAsync(Guid investmentId, DateTime nextPayoutAt, IDbConnection connection, IDbTransaction transaction);
}
