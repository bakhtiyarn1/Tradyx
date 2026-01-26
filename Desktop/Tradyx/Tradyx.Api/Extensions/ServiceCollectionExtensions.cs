using Microsoft.Extensions.DependencyInjection;
using Tradyx.Core.Interfaces;
using Tradyx.Core.Services;
using Tradyx.Core.Data.Repositories;

namespace Tradyx.Api.Extensions
{
    public static class ServiceCollectionExtensions
    {
        public static IServiceCollection AddApplicationServices(this IServiceCollection services)
        {
            services.AddScoped<IUserRepository, UserRepository>();
            services.AddScoped<AuthService>();

            return services;
        }
    }
}