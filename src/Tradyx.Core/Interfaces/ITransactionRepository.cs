using System.Data;
using Tradyx.Core.Entities;

namespace Tradyx.Core.Interfaces;

public interface ITransactionRepository
{
    Task<IEnumerable<Transaction>> GetByUserIdAsync(Guid userId, int skip = 0, int take = 50, CancellationToken cancellationToken = default);
    Task AddAsync(Transaction transaction, IDbConnection connection, IDbTransaction dbTransaction);
}
