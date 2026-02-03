namespace Tradyx.Core.Entities;

/// <summary>
/// Represents a user in the Tradyx investment platform.
/// </summary>
public class User
{
    public Guid Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public decimal Balance { get; set; }
    public Guid? ReferrerId { get; set; }
    public DateTime CreatedAt { get; set; }

    /// <summary>
    /// Creates a new user instance with validation.
    /// </summary>
    public static User Create(
        string username,
        string email,
        string passwordHash,
        decimal balance = 0,
        Guid? referrerId = null)
    {
        if (string.IsNullOrWhiteSpace(username))
            throw new ArgumentException("Username cannot be empty.", nameof(username));
        
        if (string.IsNullOrWhiteSpace(email))
            throw new ArgumentException("Email cannot be empty.", nameof(email));
        
        if (string.IsNullOrWhiteSpace(passwordHash))
            throw new ArgumentException("Password hash cannot be empty.", nameof(passwordHash));

        return new User
        {
            Id = Guid.NewGuid(),
            Username = username,
            Email = email.ToLowerInvariant(),
            PasswordHash = passwordHash,
            Balance = balance,
            ReferrerId = referrerId,
            CreatedAt = DateTime.UtcNow
        };
    }

    /// <summary>
    /// Updates the user's balance by the specified amount.
    /// </summary>
    public void UpdateBalance(decimal amount)
    {
        var newBalance = Balance + amount;
        
        if (newBalance < 0)
            throw new InvalidOperationException("Balance cannot be negative.");
        
        Balance = newBalance;
    }
}
