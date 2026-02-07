using Tradyx.Core.DTOs.Admin;

namespace Tradyx.Core.Interfaces;

public interface IAdminRepository
{
    Task<GlobalStatsResponse> GetGlobalStatsAsync(CancellationToken cancellationToken = default);
    Task<IEnumerable<UserListItem>> GetAllUsersAsync(CancellationToken cancellationToken = default);
    Task<IEnumerable<InvestmentInfoResponse>> GetRecentInvestmentsAsync(int limit = 20, CancellationToken cancellationToken = default);
    Task<UserFullDetailsResponse?> GetUserFullDetailsAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<bool> AdjustUserBalanceAsync(Guid userId, decimal amount, string reason, CancellationToken cancellationToken = default);
}
