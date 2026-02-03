using System.Data;
using Microsoft.Extensions.Configuration;
using Npgsql;
using Tradyx.Core.Interfaces;

namespace Tradyx.Infrastructure.Data;

/// <summary>
/// Factory for creating PostgreSQL database connections using Npgsql.
/// </summary>
public class DbConnectionFactory : IDbConnectionFactory
{
    private readonly string _connectionString;

    public DbConnectionFactory(IConfiguration configuration)
    {
        _connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("Connection string 'DefaultConnection' not found.");
    }

    public async Task<IDbConnection> CreateConnectionAsync(CancellationToken cancellationToken = default)
    {
        var connection = new NpgsqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);
        return connection;
    }
}
