using Microsoft.Extensions.Logging;
using Tradyx.Core.DTOs;
using Tradyx.Core.Entities;
using Tradyx.Core.Interfaces;
using Tradyx.Infrastructure.Repositories;

namespace Tradyx.Infrastructure.Services;

/// <summary>
/// Implementation of investment service with transactional support.
/// </summary>
public class InvestmentService : IInvestmentService
{
    private readonly IUserRepository _userRepository;
    private readonly InvestmentRepository _investmentRepository;
    private readonly IDbConnectionFactory _connectionFactory;
    private readonly ILogger<InvestmentService> _logger;

    public InvestmentService(
        IUserRepository userRepository,
        InvestmentRepository investmentRepository,
        IDbConnectionFactory connectionFactory,
        ILogger<InvestmentService> logger)
    {
        _userRepository = userRepository;
        _investmentRepository = investmentRepository;
        _connectionFactory = connectionFactory;
        _logger = logger;
    }

    public async Task<InvestmentResponse> PurchaseAsync(Guid userId, decimal amount, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Investment purchase attempt: User {UserId}, Amount {Amount}", userId, amount);

        // Validate minimum amount
        if (amount < 20)
        {
            return InvestmentResponse.Fail("Minimum investment amount is $20.");
        }

        // Get user
        var user = await _userRepository.GetByIdAsync(userId, cancellationToken);
        if (user is null)
        {
            _logger.LogWarning("Investment failed: User {UserId} not found", userId);
            return InvestmentResponse.Fail("User not found.");
        }

        // Check balance
        if (user.Balance < amount)
        {
            _logger.LogWarning("Investment failed: Insufficient balance. User {UserId}, Balance {Balance}, Amount {Amount}",
                userId, user.Balance, amount);
            return InvestmentResponse.Fail($"Insufficient balance. Current balance: ${user.Balance:F2}");
        }

        // Create investment
        var investment = Investment.Create(userId, amount);

        try
        {
            // Execute in transaction
            using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
            using var transaction = connection.BeginTransaction();

            try
            {
                // Deduct balance
                var newBalance = user.Balance - amount;
                const string updateBalanceSql = "UPDATE users SET balance = @Balance WHERE id = @Id";
                await Dapper.SqlMapper.ExecuteAsync(connection, updateBalanceSql,
                    new { Id = userId, Balance = newBalance }, transaction);

                // Create investment record
                await _investmentRepository.AddAsync(investment, connection, transaction);

                transaction.Commit();

                _logger.LogInformation(
                    "Investment created successfully: ID {InvestmentId}, User {UserId}, Amount {Amount}, DailyRate {DailyRate}%",
                    investment.Id, userId, amount, investment.DailyRate * 100);

                return InvestmentResponse.Ok(
                    message: "Investment purchased successfully.",
                    investmentId: investment.Id,
                    dailyRate: investment.DailyRate,
                    dailyPayout: investment.GetDailyPayout()
                );
            }
            catch
            {
                transaction.Rollback();
                throw;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create investment for user {UserId}", userId);
            return InvestmentResponse.Fail("An error occurred while processing your investment. Please try again.");
        }
    }

    public async Task<IEnumerable<InvestmentResponse>> GetUserInvestmentsAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var investments = await _investmentRepository.GetByUserIdAsync(userId, cancellationToken);

        return investments.Select(inv => new InvestmentResponse
        {
            Success = true,
            Message = inv.IsActive ? "Active" : "Inactive",
            InvestmentId = inv.Id,
            DailyRate = inv.DailyRate,
            DailyPayout = inv.GetDailyPayout()
        });
    }
}
