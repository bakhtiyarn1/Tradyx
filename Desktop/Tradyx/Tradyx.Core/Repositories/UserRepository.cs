using Dapper;
using Tradyx.Core.Entities;
using Tradyx.Core.Interfaces;
using Tradyx.Core.Abstractions;

namespace Tradyx.Core.Data.Repositories
{
    public class UserRepository : IUserRepository
    {
        private readonly IDbConnectionFactory _connectionFactory;

        public UserRepository(IDbConnectionFactory connectionFactory)
        {
            _connectionFactory = connectionFactory;
        }

        public async Task<User?> GetByUsernameAsync(string username)
        {
            using var connection = _connectionFactory.CreateConnection();
            connection.Open();

            const string sql = """
                                   SELECT *
                                   FROM users
                                   WHERE username = @Username
                               """;

            return await connection.QuerySingleOrDefaultAsync<User>(
                sql,
                new { Username = username }
            );
        }

        public async Task CreateAsync(User user)
        {
            using var connection = _connectionFactory.CreateConnection();
            connection.Open();

            const string sql = """
                                   INSERT INTO users (id, username, email, password_hash, referrer_id, created_at)
                                   VALUES (@Id, @Username, @Email, @PasswordHash, @ReferrerId, @CreatedAt)
                               """;

            await connection.ExecuteAsync(sql, user);
        }
    }
}