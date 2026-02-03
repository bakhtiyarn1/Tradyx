using Tradyx.Core.Entities;

namespace Tradyx.Core.Interfaces;

/// <summary>
/// Repository interface for investment operations.
/// </summary>
public interface IInvestmentRepository
{
    /// <summary>
    /// Adds a new investment.
    /// </summary>
    Task AddAsync(Investment investment, CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets all active investments.
    /// </summary>
    Task<IEnumerable<Investment>> GetActiveInvestmentsAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets all investments for a specific user.
    /// </summary>
    Task<IEnumerable<Investment>> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Updates an existing investment.
    /// </summary>
    Task UpdateAsync(Investment investment, CancellationToken cancellationToken = default);
}
