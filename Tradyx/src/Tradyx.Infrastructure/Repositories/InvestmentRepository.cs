using System.Data;
using Dapper;
using Tradyx.Core.Entities;
using Tradyx.Core.Interfaces;

namespace Tradyx.Infrastructure.Repositories;

/// <summary>
/// Dapper-based implementation of IInvestmentRepository.
/// </summary>
public class InvestmentRepository : IInvestmentRepository
{
    private readonly IDbConnectionFactory _connectionFactory;

    public InvestmentRepository(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task AddAsync(Investment investment, CancellationToken cancellationToken = default)
    {
        const string sql =
            "INSERT INTO investments (id, user_id, amount, daily_rate, created_at, next_payout_at, is_active) " +
            "VALUES (@Id, @UserId, @Amount, @DailyRate, @CreatedAt, @NextPayoutAt, @IsActive)";

        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
        await connection.ExecuteAsync(sql, new
        {
            investment.Id,
            investment.UserId,
            investment.Amount,
            investment.DailyRate,
            investment.CreatedAt,
            investment.NextPayoutAt,
            investment.IsActive
        });
    }

    public async Task<IEnumerable<Investment>> GetActiveInvestmentsAsync(CancellationToken cancellationToken = default)
    {
        const string sql =
            "SELECT id, user_id, amount, daily_rate, created_at, next_payout_at, is_active " +
            "FROM investments WHERE is_active = true";

        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
        return await connection.QueryAsync<Investment>(sql);
    }

    public async Task<IEnumerable<Investment>> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        const string sql =
            "SELECT id, user_id, amount, daily_rate, created_at, next_payout_at, is_active " +
            "FROM investments WHERE user_id = @UserId ORDER BY created_at DESC";

        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
        return await connection.QueryAsync<Investment>(sql, new { UserId = userId });
    }

    public async Task UpdateAsync(Investment investment, CancellationToken cancellationToken = default)
    {
        const string sql =
            "UPDATE investments SET " +
            "amount = @Amount, daily_rate = @DailyRate, next_payout_at = @NextPayoutAt, is_active = @IsActive " +
            "WHERE id = @Id";

        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
        await connection.ExecuteAsync(sql, new
        {
            investment.Id,
            investment.Amount,
            investment.DailyRate,
            investment.NextPayoutAt,
            investment.IsActive
        });
    }

    /// <summary>
    /// Adds investment within an existing transaction.
    /// </summary>
    public async Task AddAsync(Investment investment, IDbConnection connection, IDbTransaction transaction)
    {
        const string sql =
            "INSERT INTO investments (id, user_id, amount, daily_rate, created_at, next_payout_at, is_active) " +
            "VALUES (@Id, @UserId, @Amount, @DailyRate, @CreatedAt, @NextPayoutAt, @IsActive)";

        await connection.ExecuteAsync(sql, new
        {
            investment.Id,
            investment.UserId,
            investment.Amount,
            investment.DailyRate,
            investment.CreatedAt,
            investment.NextPayoutAt,
            investment.IsActive
        }, transaction);
    }
}
