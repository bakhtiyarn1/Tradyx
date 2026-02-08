using Tradyx.Core.DTOs.Admin;
using Tradyx.Core.Entities;

namespace Tradyx.Core.Interfaces;

public interface IAdminRepository
{
    Task<GlobalStatsResponse> GetGlobalStatsAsync(CancellationToken cancellationToken = default);
    Task<IEnumerable<UserListItem>> GetAllUsersAsync(CancellationToken cancellationToken = default);
    Task<IEnumerable<InvestmentInfoResponse>> GetRecentInvestmentsAsync(int limit = 20, CancellationToken cancellationToken = default);
    Task<UserFullDetailsResponse?> GetUserFullDetailsAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<bool> AdjustUserBalanceAsync(Guid userId, decimal amount, string reason, CancellationToken cancellationToken = default);

    // Investment Plans CRUD
    Task<IEnumerable<InvestmentPlanDto>> GetAllPlansAsync(CancellationToken cancellationToken = default);
    Task<InvestmentPlanDto?> GetPlanByIdAsync(Guid planId, CancellationToken cancellationToken = default);
    Task<InvestmentPlan> CreatePlanAsync(CreatePlanRequest request, CancellationToken cancellationToken = default);
    Task<bool> UpdatePlanAsync(Guid planId, UpdatePlanRequest request, CancellationToken cancellationToken = default);
    Task<bool> DeletePlanAsync(Guid planId, CancellationToken cancellationToken = default);

    // Analytics
    Task<AnalyticsResponse> GetAnalyticsAsync(int days = 14, CancellationToken cancellationToken = default);
}
