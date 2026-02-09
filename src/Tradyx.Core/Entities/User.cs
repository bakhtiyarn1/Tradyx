namespace Tradyx.Core.Entities;

public enum UserRank
{
    Bronze = 0,
    Silver = 1,
    Gold = 2,
    Platinum = 3
}

public class User
{
    public Guid Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public decimal Balance { get; set; }
    public Guid? ReferrerId { get; set; }

    /// <summary>Unique 8-char alphanumeric invite code.</summary>
    public string InviteCode { get; set; } = string.Empty;

    /// <summary>Ancestor chain root→parent, e.g. "grandpaId/parentId".</summary>
    public string? ReferralPath { get; set; }

    /// <summary>User loyalty status: Bronze(0), Silver(1), Gold(2), Platinum(3).</summary>
    public int Status { get; set; } = (int)UserRank.Bronze;

    /// <summary>Cumulative personal investment amount (sum of all-time investments).</summary>
    public decimal PersonalTurnover { get; set; }

    /// <summary>Cumulative team turnover across 3 referral levels.</summary>
    public decimal TeamTurnover { get; set; }

    /// <summary>Telegram user ID for bot-based authentication.</summary>
    public long? TelegramId { get; set; }

    /// <summary>IP address at the time of registration.</summary>
    public string? RegistrationIp { get; set; }

    /// <summary>Flag for manual admin review (e.g., same IP as referrer).</summary>
    public bool IsSuspicious { get; set; }

    public DateTime CreatedAt { get; set; }

    public UserRank Rank => (UserRank)Status;

    /// <summary>Generate a unique 8-char alphanumeric invite code.</summary>
    public static string GenerateInviteCode()
    {
        return Convert.ToBase64String(Guid.NewGuid().ToByteArray())
            .Replace("/", "")
            .Replace("+", "")
            .Replace("=", "")
            [..8]
            .ToUpperInvariant();
    }
}
