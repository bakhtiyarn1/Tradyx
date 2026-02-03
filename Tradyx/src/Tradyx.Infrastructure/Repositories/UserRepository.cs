using System.Data;
using Dapper;
using Npgsql;
using Tradyx.Core.Entities;
using Tradyx.Core.Interfaces;

namespace Tradyx.Infrastructure.Repositories;

/// <summary>
/// Dapper-based implementation of IUserRepository for PostgreSQL.
/// </summary>
public class UserRepository : IUserRepository
{
    private readonly IDbConnectionFactory _connectionFactory;

    public UserRepository(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<User?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        const string sql = 
            "SELECT id, username, email, password_hash, balance, referrer_id, created_at " +
            "FROM users WHERE id = @Id";

        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
        return await connection.QuerySingleOrDefaultAsync<User>(sql, new { Id = id });
    }

    public async Task<User?> GetByEmailAsync(string email, CancellationToken cancellationToken = default)
    {
        const string sql = 
            "SELECT id, username, email, password_hash, balance, referrer_id, created_at " +
            "FROM users WHERE email = @Email";

        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
        return await connection.QuerySingleOrDefaultAsync<User>(sql, new { Email = email.ToLowerInvariant() });
    }

    public async Task<User?> GetByUsernameAsync(string username, CancellationToken cancellationToken = default)
    {
        const string sql = 
            "SELECT id, username, email, password_hash, balance, referrer_id, created_at " +
            "FROM users WHERE username = @Username";

        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
        return await connection.QuerySingleOrDefaultAsync<User>(sql, new { Username = username });
    }

    public async Task<User> AddAsync(User user, CancellationToken cancellationToken = default)
    {
        const string sql = 
            "INSERT INTO users (id, username, email, password_hash, balance, referrer_id, created_at) " +
            "VALUES (@Id, @Username, @Email, @PasswordHash, @Balance, @ReferrerId, @CreatedAt) " +
            "RETURNING id, username, email, password_hash, balance, referrer_id, created_at";

        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
        return await connection.QuerySingleAsync<User>(sql, new
        {
            user.Id,
            user.Username,
            user.Email,
            user.PasswordHash,
            user.Balance,
            user.ReferrerId,
            user.CreatedAt
        });
    }

    public async Task UpdateBalanceAsync(Guid userId, decimal newBalance, CancellationToken cancellationToken = default)
    {
        const string sql = "UPDATE users SET balance = @Balance WHERE id = @Id";

        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
        var affected = await connection.ExecuteAsync(sql, new { Id = userId, Balance = newBalance });

        if (affected == 0)
            throw new InvalidOperationException($"User with ID {userId} not found.");
    }
}
