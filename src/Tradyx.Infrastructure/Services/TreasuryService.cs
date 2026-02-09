using System.Globalization;
using Dapper;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Tradyx.Core.Entities;
using Tradyx.Core.Interfaces;

namespace Tradyx.Infrastructure.Services;

public class TreasuryService : ITreasuryService
{
    private readonly IDbConnectionFactory _connectionFactory;
    private readonly ITelegramNotifier _telegram;
    private readonly ILogger<TreasuryService> _logger;

    // Config: Insurance
    private readonly decimal _insuranceRate;

    // Config: Dynamic Rates
    private readonly decimal _greenThreshold;
    private readonly decimal _yellowThreshold;
    private readonly decimal _yellowRateMultiplier;
    private readonly decimal _redRateMultiplier;

    // Config: Daily Limits
    private readonly decimal _dailyLimitPercent; // % of reserve
    private readonly decimal _dailyLimitMin;     // absolute minimum daily limit
    private readonly Dictionary<UserRank, decimal> _personalLimits;

    // Config: Cooling Period
    private readonly int _coolingSmallHours;     // deposit < $100
    private readonly int _coolingMediumHours;    // deposit $100-1000
    private readonly int _coolingLargeHours;     // deposit > $1000
    private readonly decimal _coolingMediumThreshold;
    private readonly decimal _coolingLargeThreshold;

    public TreasuryService(
        IDbConnectionFactory connectionFactory,
        ITelegramNotifier telegram,
        IConfiguration configuration,
        ILogger<TreasuryService> logger)
    {
        _connectionFactory = connectionFactory;
        _telegram = telegram;
        _logger = logger;

        var ins = configuration.GetSection("TreasurySettings:Insurance");
        _insuranceRate = ParseDec(ins["Rate"], 0.05m);

        var dyn = configuration.GetSection("TreasurySettings:DynamicRates");
        _greenThreshold = ParseDec(dyn["GreenThreshold"], 0.50m);
        _yellowThreshold = ParseDec(dyn["YellowThreshold"], 0.25m);
        _yellowRateMultiplier = ParseDec(dyn["YellowMultiplier"], 0.80m);
        _redRateMultiplier = ParseDec(dyn["RedMultiplier"], 0.60m);

        var lim = configuration.GetSection("TreasurySettings:DailyLimits");
        _dailyLimitPercent = ParseDec(lim["PercentOfReserve"], 0.10m);
        _dailyLimitMin = ParseDec(lim["MinimumAmount"], 500m);

        _personalLimits = new()
        {
            [UserRank.Bronze] = ParseDec(lim["Personal:Bronze"], 200m),
            [UserRank.Silver] = ParseDec(lim["Personal:Silver"], 500m),
            [UserRank.Gold] = ParseDec(lim["Personal:Gold"], 1000m),
            [UserRank.Platinum] = ParseDec(lim["Personal:Platinum"], 2000m),
        };

        var cool = configuration.GetSection("TreasurySettings:CoolingPeriod");
        _coolingSmallHours = int.TryParse(cool["SmallHours"], out var sh) ? sh : 24;
        _coolingMediumHours = int.TryParse(cool["MediumHours"], out var mh) ? mh : 72;
        _coolingLargeHours = int.TryParse(cool["LargeHours"], out var lh) ? lh : 168;
        _coolingMediumThreshold = ParseDec(cool["MediumThreshold"], 100m);
        _coolingLargeThreshold = ParseDec(cool["LargeThreshold"], 1000m);

        _logger.LogInformation(
            "[Treasury] Insurance={Ins}%, Green>{Green}%, Yellow>{Yellow}%, DailyLimit={Lim}% of reserve, " +
            "Personal limits: B=${B}, S=${S}, G=${G}, P=${P}, " +
            "Cooling: <${MT}={SH}h, <${LT}={MH}h, >=${LT2}={LH}h",
            _insuranceRate * 100, _greenThreshold * 100, _yellowThreshold * 100, _dailyLimitPercent * 100,
            _personalLimits[UserRank.Bronze], _personalLimits[UserRank.Silver],
            _personalLimits[UserRank.Gold], _personalLimits[UserRank.Platinum],
            _coolingMediumThreshold, _coolingSmallHours,
            _coolingLargeThreshold, _coolingMediumHours, _coolingLargeThreshold, _coolingLargeHours);
    }

    // ============================================================
    // Treasury Health
    // ============================================================

    public async Task<TreasuryHealth> GetHealthAsync(CancellationToken cancellationToken = default)
    {
        using var conn = await _connectionFactory.CreateConnectionAsync(cancellationToken);

        const string sql = @"
            SELECT
                COALESCE((SELECT SUM(amount) FROM transactions WHERE type = 'Deposit' AND status = 'Completed'), 0) AS total_deposits,
                COALESCE((SELECT SUM(ABS(amount)) FROM transactions WHERE type IN ('Withdrawal') AND status IN ('Completed','Pending')), 0)
                + COALESCE((SELECT SUM(amount) FROM transactions WHERE type IN ('Profit','ReferralBonus','Cashback')), 0) AS total_payouts,
                COALESCE((SELECT SUM(amount) FROM investments WHERE is_active = true), 0) AS active_investments,
                COALESCE((SELECT SUM(amount) FROM transactions WHERE type = 'InsuranceFee'), 0) AS insurance_fund,
                COALESCE((SELECT SUM(ABS(amount)) FROM transactions
                    WHERE type = 'Withdrawal' AND status IN ('Completed','Pending')
                    AND created_at >= CURRENT_DATE), 0) AS withdrawn_today,
                COALESCE((SELECT AVG(daily_payout) FROM (
                    SELECT SUM(amount) AS daily_payout FROM transactions
                    WHERE type = 'Profit' AND created_at >= NOW() - INTERVAL '7 days'
                    GROUP BY DATE(created_at)
                ) sub), 0) AS avg_daily_payout";

        var row = await conn.QuerySingleAsync<dynamic>(sql);

        decimal totalDeposits = (decimal)(row.total_deposits ?? 0m);
        decimal totalPayouts = (decimal)(row.total_payouts ?? 0m);
        decimal activeInvestments = (decimal)(row.active_investments ?? 0m);
        decimal insuranceFund = (decimal)(row.insurance_fund ?? 0m);
        decimal withdrawnToday = (decimal)(row.withdrawn_today ?? 0m);
        decimal avgDailyPayout = (decimal)(row.avg_daily_payout ?? 0m);

        decimal reserve = totalDeposits - totalPayouts;
        decimal healthRatio = activeInvestments > 0 ? reserve / activeInvestments : 1.0m;

        string zone;
        decimal rateMultiplier;
        if (healthRatio >= _greenThreshold)
        {
            zone = "green";
            rateMultiplier = 1.0m;
        }
        else if (healthRatio >= _yellowThreshold)
        {
            zone = "yellow";
            rateMultiplier = _yellowRateMultiplier;
        }
        else
        {
            zone = "red";
            rateMultiplier = _redRateMultiplier;
        }

        decimal dailyLimit = Math.Max(_dailyLimitMin, reserve * _dailyLimitPercent);
        int runwayDays = avgDailyPayout > 0 ? (int)(reserve / avgDailyPayout) : 999;

        return new TreasuryHealth
        {
            TotalDeposits = totalDeposits,
            TotalPayouts = totalPayouts,
            Reserve = reserve,
            ActiveInvestments = activeInvestments,
            InsuranceFund = insuranceFund,
            HealthRatio = Math.Round(healthRatio, 4),
            Zone = zone,
            RateMultiplier = rateMultiplier,
            WithdrawnToday = withdrawnToday,
            DailyWithdrawalLimit = Math.Round(dailyLimit, 2),
            EstimatedRunwayDays = runwayDays
        };
    }

    public async Task<decimal> GetRateMultiplierAsync(CancellationToken cancellationToken = default)
    {
        var health = await GetHealthAsync(cancellationToken);
        return health.RateMultiplier;
    }

    // ============================================================
    // Insurance Fund
    // ============================================================

    public async Task<(decimal NetAmount, decimal InsuranceFee)> ProcessDepositInsuranceAsync(
        Guid userId, decimal grossAmount, System.Data.IDbConnection conn, System.Data.IDbTransaction tx)
    {
        var fee = Math.Round(grossAmount * _insuranceRate, 2);
        var net = grossAmount - fee;

        if (fee > 0)
        {
            // Record insurance fee as a special transaction (positive amount = fund grows)
            var insTx = Transaction.Create(userId, fee, "InsuranceFee",
                $"Insurance fund contribution ({_insuranceRate * 100:F0}% of ${grossAmount:F2})");
            await conn.ExecuteAsync(@"
                INSERT INTO transactions (id, user_id, amount, type, description, created_at)
                VALUES (@Id, @UserId, @Amount, @Type, @Description, @CreatedAt)",
                new { insTx.Id, insTx.UserId, insTx.Amount, insTx.Type, insTx.Description, insTx.CreatedAt }, tx);

            _logger.LogInformation("[Treasury] Insurance fee ${Fee:F2} from deposit ${Gross:F2} for user {UserId}",
                fee, grossAmount, userId);
        }

        return (net, fee);
    }

    // ============================================================
    // Daily Withdrawal Limits
    // ============================================================

    public async Task<DailyLimitCheck> CheckDailyWithdrawalLimitAsync(
        Guid userId, decimal amount, CancellationToken cancellationToken = default)
    {
        using var conn = await _connectionFactory.CreateConnectionAsync(cancellationToken);

        // Platform-wide: how much withdrawn today
        var platformToday = await conn.QuerySingleAsync<decimal>(
            @"SELECT COALESCE(SUM(ABS(amount)), 0) FROM transactions
              WHERE type = 'Withdrawal' AND status IN ('Completed','Pending')
              AND created_at >= CURRENT_DATE");

        // User personal: how much this user withdrew today
        var personalToday = await conn.QuerySingleAsync<decimal>(
            @"SELECT COALESCE(SUM(ABS(amount)), 0) FROM transactions
              WHERE type = 'Withdrawal' AND status IN ('Completed','Pending')
              AND user_id = @UserId AND created_at >= CURRENT_DATE",
            new { UserId = userId });

        // Get user rank for personal limit
        var userRank = await conn.QuerySingleOrDefaultAsync<int>(
            "SELECT status FROM users WHERE id = @UserId", new { UserId = userId });
        var rank = (UserRank)userRank;
        var personalLimit = _personalLimits.GetValueOrDefault(rank, 200m);

        // Calculate platform limit from reserve
        var health = await GetHealthAsync(cancellationToken);
        var platformLimit = health.DailyWithdrawalLimit;

        // Check platform limit
        if (platformToday + amount > platformLimit)
        {
            var remaining = Math.Max(0, platformLimit - platformToday);
            return new DailyLimitCheck(false,
                $"Platform daily withdrawal limit reached. Remaining today: ${remaining:F2}. Try again tomorrow.",
                platformToday, platformLimit, personalToday, personalLimit);
        }

        // Check personal limit
        if (personalToday + amount > personalLimit)
        {
            var remaining = Math.Max(0, personalLimit - personalToday);
            return new DailyLimitCheck(false,
                $"Your daily withdrawal limit is ${personalLimit:F0} ({rank}). Remaining today: ${remaining:F2}. Upgrade your rank for higher limits.",
                platformToday, platformLimit, personalToday, personalLimit);
        }

        return new DailyLimitCheck(true, null, platformToday, platformLimit, personalToday, personalLimit);
    }

    public decimal GetPersonalDailyLimit(int userRank)
    {
        var rank = (UserRank)userRank;
        return _personalLimits.GetValueOrDefault(rank, 200m);
    }

    // ============================================================
    // Cooling Period
    // ============================================================

    public async Task<CoolingPeriodCheck> CheckCoolingPeriodAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        using var conn = await _connectionFactory.CreateConnectionAsync(cancellationToken);

        // Find the most recent deposit
        var lastDeposit = await conn.QuerySingleOrDefaultAsync<(decimal Amount, DateTime CreatedAt)?>(
            @"SELECT amount, created_at FROM transactions
              WHERE user_id = @UserId AND type = 'Deposit' AND status = 'Completed'
              ORDER BY created_at DESC LIMIT 1",
            new { UserId = userId });

        if (lastDeposit == null)
            return new CoolingPeriodCheck(true, null, 0, null); // No deposits = no cooling

        var depositAmount = lastDeposit.Value.Amount;
        var depositTime = lastDeposit.Value.CreatedAt;

        // Determine cooling hours based on deposit size
        int coolingHours;
        if (depositAmount >= _coolingLargeThreshold)
            coolingHours = _coolingLargeHours;
        else if (depositAmount >= _coolingMediumThreshold)
            coolingHours = _coolingMediumHours;
        else
            coolingHours = _coolingSmallHours;

        var unlocksAt = depositTime.AddHours(coolingHours);
        if (DateTime.UtcNow >= unlocksAt)
            return new CoolingPeriodCheck(true, null, 0, null);

        var hoursLeft = (int)Math.Ceiling((unlocksAt - DateTime.UtcNow).TotalHours);
        return new CoolingPeriodCheck(false,
            $"Cooling period active. Your last deposit of ${depositAmount:F2} requires a {coolingHours}h waiting period. Available in {hoursLeft}h.",
            hoursLeft, unlocksAt);
    }

    private static decimal ParseDec(string? s, decimal fallback) =>
        decimal.TryParse(s, NumberStyles.Any, CultureInfo.InvariantCulture, out var v) ? v : fallback;
}
