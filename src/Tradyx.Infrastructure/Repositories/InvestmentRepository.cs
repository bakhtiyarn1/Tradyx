using System.Data;
using Dapper;
using Tradyx.Core.Entities;
using Tradyx.Core.Interfaces;

namespace Tradyx.Infrastructure.Repositories;

public class InvestmentRepository : IInvestmentRepository
{
    private readonly IDbConnectionFactory _connectionFactory;

    public InvestmentRepository(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<IEnumerable<Investment>> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        const string sql = "SELECT * FROM investments WHERE user_id = @UserId ORDER BY created_at DESC";
        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
        return await connection.QueryAsync<Investment>(sql, new { UserId = userId });
    }

    public async Task<IEnumerable<Investment>> GetDueForPayoutAsync(CancellationToken cancellationToken = default)
    {
        const string sql = "SELECT * FROM investments WHERE is_active = true AND next_payout_at <= NOW()";
        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
        return await connection.QueryAsync<Investment>(sql);
    }

    public async Task AddAsync(Investment investment, IDbConnection connection, IDbTransaction transaction)
    {
        const string sql = @"
            INSERT INTO investments (id, user_id, amount, daily_rate, created_at, next_payout_at, is_active, remaining_payouts)
            VALUES (@Id, @UserId, @Amount, @DailyRate, @CreatedAt, @NextPayoutAt, @IsActive, @RemainingPayouts)";
        await connection.ExecuteAsync(sql, investment, transaction);
    }

    public async Task UpdateNextPayoutAsync(Guid investmentId, DateTime nextPayoutAt, IDbConnection connection, IDbTransaction transaction)
    {
        const string sql = "UPDATE investments SET next_payout_at = @NextPayoutAt WHERE id = @Id";
        await connection.ExecuteAsync(sql, new { Id = investmentId, NextPayoutAt = nextPayoutAt }, transaction);
    }
}
