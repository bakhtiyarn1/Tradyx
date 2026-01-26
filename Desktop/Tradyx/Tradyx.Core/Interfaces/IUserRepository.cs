using Tradyx.Core.Entities;

namespace Tradyx.Core.Interfaces
{
    public interface IUserRepository
    {
        Task<User?> GetByUsernameAsync(string username);
        Task CreateAsync(User user);
    }
}