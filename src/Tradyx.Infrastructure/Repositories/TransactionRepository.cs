using System.Data;
using Dapper;
using Tradyx.Core.Entities;
using Tradyx.Core.Interfaces;

namespace Tradyx.Infrastructure.Repositories;

public class TransactionRepository : ITransactionRepository
{
    private readonly IDbConnectionFactory _connectionFactory;

    public TransactionRepository(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<IEnumerable<Transaction>> GetByUserIdAsync(Guid userId, int skip = 0, int take = 50, CancellationToken cancellationToken = default)
    {
        const string sql = @"
            SELECT * FROM transactions WHERE user_id = @UserId
            ORDER BY created_at DESC OFFSET @Skip LIMIT @Take";
        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
        return await connection.QueryAsync<Transaction>(sql, new { UserId = userId, Skip = skip, Take = take });
    }

    public async Task AddAsync(Transaction transaction, IDbConnection connection, IDbTransaction dbTransaction)
    {
        const string sql = @"
            INSERT INTO transactions (id, user_id, amount, type, description, status, fee_amount, is_instant, wallet_address, created_at)
            VALUES (@Id, @UserId, @Amount, @Type, @Description, @Status, @FeeAmount, @IsInstant, @WalletAddress, @CreatedAt)";
        await connection.ExecuteAsync(sql, transaction, dbTransaction);
    }
}
