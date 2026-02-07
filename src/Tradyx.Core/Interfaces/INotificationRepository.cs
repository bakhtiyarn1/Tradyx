using System.Data;
using Tradyx.Core.Entities;

namespace Tradyx.Core.Interfaces;

public interface INotificationRepository
{
    Task<IEnumerable<Notification>> GetUserNotificationsAsync(Guid userId, int limit = 20, CancellationToken cancellationToken = default);
    Task<int> GetUnreadCountAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<bool> MarkAsReadAsync(Guid notificationId, Guid userId, CancellationToken cancellationToken = default);
    Task MarkAllAsReadAsync(Guid userId, CancellationToken cancellationToken = default);
    Task AddAsync(Notification notification, IDbConnection connection, IDbTransaction dbTransaction);
}
