using Dapper;
using Microsoft.Extensions.DependencyInjection;
using Tradyx.Core.Interfaces;
using Tradyx.Infrastructure.Data;
using Tradyx.Infrastructure.Repositories;
using Tradyx.Infrastructure.Security;
using Tradyx.Infrastructure.Services;

namespace Tradyx.Infrastructure;

/// <summary>
/// Extension methods for registering Infrastructure services.
/// </summary>
public static class DependencyInjection
{
    /// <summary>
    /// Adds Infrastructure layer services to the dependency injection container.
    /// </summary>
    public static IServiceCollection AddInfrastructure(this IServiceCollection services)
    {
        // Configure Dapper to map snake_case columns to PascalCase properties
        DefaultTypeMap.MatchNamesWithUnderscores = true;

        // Database
        services.AddSingleton<IDbConnectionFactory, DbConnectionFactory>();

        // Security
        services.AddSingleton<IPasswordHasher, PasswordHasher>();

        // Repositories
        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IInvestmentRepository, InvestmentRepository>();
        services.AddScoped<InvestmentRepository>(); // For transactional methods

        // Services
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IInvestmentService, InvestmentService>();

        return services;
    }
}
