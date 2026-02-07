namespace Tradyx.Core.Entities;

/// <summary>Logs every rank upgrade event.</summary>
public class UserRankHistory
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public int OldRank { get; set; }
    public int NewRank { get; set; }
    public decimal PersonalTurnover { get; set; }
    public decimal TeamTurnover { get; set; }
    public DateTime CreatedAt { get; set; }

    public static UserRankHistory Create(Guid userId, UserRank oldRank, UserRank newRank, decimal personal, decimal team)
    {
        return new UserRankHistory
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            OldRank = (int)oldRank,
            NewRank = (int)newRank,
            PersonalTurnover = personal,
            TeamTurnover = team,
            CreatedAt = DateTime.UtcNow
        };
    }
}
