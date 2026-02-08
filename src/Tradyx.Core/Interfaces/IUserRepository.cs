using Tradyx.Core.DTOs.User;
using Tradyx.Core.Entities;

namespace Tradyx.Core.Interfaces;

public interface IUserRepository
{
    Task<User?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<User?> GetByEmailAsync(string email, CancellationToken cancellationToken = default);
    Task<User?> GetByUsernameAsync(string username, CancellationToken cancellationToken = default);
    Task<User?> GetByInviteCodeAsync(string inviteCode, CancellationToken cancellationToken = default);
    Task<User> CreateAsync(User user, CancellationToken cancellationToken = default);
    Task<UserDashboardResponse?> GetDashboardAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<bool> DepositAsync(Guid userId, decimal amount, CancellationToken cancellationToken = default);
}
