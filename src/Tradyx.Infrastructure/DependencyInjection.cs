using Dapper;
using Microsoft.Extensions.DependencyInjection;
using Tradyx.Core.Interfaces;
using Tradyx.Infrastructure.BackgroundServices;
using Tradyx.Infrastructure.Data;
using Tradyx.Infrastructure.Repositories;
using Tradyx.Infrastructure.Security;
using Tradyx.Infrastructure.Services;

namespace Tradyx.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services)
    {
        DefaultTypeMap.MatchNamesWithUnderscores = true;

        // Database
        services.AddSingleton<IDbConnectionFactory, DbConnectionFactory>();

        // Security
        services.AddSingleton<IPasswordHasher, PasswordHasher>();

        // Repositories
        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IInvestmentRepository, InvestmentRepository>();
        services.AddScoped<InvestmentRepository>();
        services.AddScoped<ITransactionRepository, TransactionRepository>();
        services.AddScoped<TransactionRepository>();
        services.AddScoped<IAdminRepository, AdminRepository>();
        services.AddScoped<INotificationRepository, NotificationRepository>();
        services.AddScoped<NotificationRepository>();

        // Services
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IInvestmentService, InvestmentService>();
        services.AddScoped<IRankService, RankService>();
        services.AddScoped<IReferralService, ReferralService>();
        services.AddScoped<IWithdrawalService, WithdrawalService>();
        services.AddScoped<IPayoutService, PayoutService>();
        services.AddScoped<ITreasuryService, TreasuryService>();

        // Telegram
        services.AddSingleton<ITelegramNotifier, TelegramNotifierService>();

        // Background Services
        services.AddHostedService<PayoutWorker>();

        return services;
    }
}
