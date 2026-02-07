using System.Data;
using Dapper;
using Tradyx.Core.Entities;
using Tradyx.Core.Interfaces;

namespace Tradyx.Infrastructure.Repositories;

public class NotificationRepository : INotificationRepository
{
    private readonly IDbConnectionFactory _connectionFactory;

    public NotificationRepository(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<IEnumerable<Notification>> GetUserNotificationsAsync(Guid userId, int limit = 20, CancellationToken cancellationToken = default)
    {
        const string sql = "SELECT * FROM notifications WHERE user_id = @UserId ORDER BY created_at DESC LIMIT @Limit";
        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
        return await connection.QueryAsync<Notification>(sql, new { UserId = userId, Limit = limit });
    }

    public async Task<int> GetUnreadCountAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        const string sql = "SELECT COUNT(*) FROM notifications WHERE user_id = @UserId AND is_read = false";
        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
        return await connection.ExecuteScalarAsync<int>(sql, new { UserId = userId });
    }

    public async Task<bool> MarkAsReadAsync(Guid notificationId, Guid userId, CancellationToken cancellationToken = default)
    {
        const string sql = "UPDATE notifications SET is_read = true WHERE id = @Id AND user_id = @UserId";
        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
        var affected = await connection.ExecuteAsync(sql, new { Id = notificationId, UserId = userId });
        return affected > 0;
    }

    public async Task MarkAllAsReadAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        const string sql = "UPDATE notifications SET is_read = true WHERE user_id = @UserId AND is_read = false";
        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
        await connection.ExecuteAsync(sql, new { UserId = userId });
    }

    public async Task AddAsync(Notification notification, IDbConnection connection, IDbTransaction dbTransaction)
    {
        const string sql = @"
            INSERT INTO notifications (id, user_id, message, is_read, created_at)
            VALUES (@Id, @UserId, @Message, @IsRead, @CreatedAt)";
        await connection.ExecuteAsync(sql, notification, dbTransaction);
    }
}
