using Tradyx.Core.DTOs;
using Tradyx.Core.Entities;
using Tradyx.Core.Interfaces;
using BCrypt.Net;

namespace Tradyx.Core.Services
{
    public class AuthService
    {
        private readonly IUserRepository _userRepository;

        public AuthService(IUserRepository userRepository)
        {
            _userRepository = userRepository;
        }

        public async Task RegisterAsync(RegisterRequest request)
        {
            Guid? referrerId = null;

            if (!string.IsNullOrWhiteSpace(request.ReferrerCode))
            {
                var referrer = await _userRepository.GetByUsernameAsync(request.ReferrerCode);
                if (referrer == null)
                    throw new Exception("Referrer not found");

                referrerId = referrer.Id;
            }

            var user = new User
            {
                Id = Guid.NewGuid(),
                Username = request.Username,
                Email = request.Email,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
                ReferrerId = referrerId,
                CreatedAt = DateTime.UtcNow
            };

            await _userRepository.CreateAsync(user);
        }
    }
}