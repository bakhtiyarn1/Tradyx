namespace Tradyx.Core.Interfaces;

public interface IWithdrawalService
{
    /// <summary>Create a withdrawal request (Regular = Pending queue, Instant = immediate with fee).</summary>
    Task<WithdrawalResult> RequestWithdrawalAsync(
        Guid userId, decimal amount, bool isInstant, string? walletAddress,
        CancellationToken cancellationToken = default);

    /// <summary>Admin: get all pending withdrawal requests.</summary>
    Task<IEnumerable<PendingWithdrawalDto>> GetPendingWithdrawalsAsync(CancellationToken cancellationToken = default);

    /// <summary>Admin: approve a pending withdrawal.</summary>
    Task<(bool Success, string? Error)> ApproveWithdrawalAsync(Guid transactionId, CancellationToken cancellationToken = default);

    /// <summary>Admin: reject a pending withdrawal — refund balance.</summary>
    Task<(bool Success, string? Error)> RejectWithdrawalAsync(Guid transactionId, string? reason, CancellationToken cancellationToken = default);

    /// <summary>Get withdrawal info (fee, limits) for UI.</summary>
    WithdrawalInfoDto GetWithdrawalInfo(int userRank);

    /// <summary>Get referral qualification status for withdrawal eligibility.</summary>
    Task<ReferralQualificationDto> GetReferralQualificationAsync(Guid userId, CancellationToken cancellationToken = default);
}

public record WithdrawalResult(bool Success, string? Error, Guid? TransactionId = null,
    decimal NetAmount = 0, decimal Fee = 0, string Status = "");

public record ReferralQualificationDto(int ActiveReferrals, int Required, bool Qualified);

public record PendingWithdrawalDto
{
    public Guid Id { get; init; }
    public Guid UserId { get; init; }
    public string Username { get; init; } = string.Empty;
    public string Email { get; init; } = string.Empty;
    public decimal Amount { get; init; }
    public decimal FeeAmount { get; init; }
    public bool IsInstant { get; init; }
    public string? WalletAddress { get; init; }
    public DateTime CreatedAt { get; init; }
}

public record WithdrawalInfoDto(decimal FeeRate, decimal MaxInstant, decimal MinAmount, decimal FeeDiscount);
