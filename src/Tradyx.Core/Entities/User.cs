namespace Tradyx.Core.Entities;

public class User
{
    public Guid Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public decimal Balance { get; set; }
    public Guid? ReferrerId { get; set; }
    public DateTime CreatedAt { get; set; }
}
