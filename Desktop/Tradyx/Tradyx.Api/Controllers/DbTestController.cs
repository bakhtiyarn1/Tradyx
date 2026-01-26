using Dapper;
using Microsoft.AspNetCore.Mvc;
using Tradyx.Core.Abstractions;

namespace Tradyx.Api.Controllers
{
    [ApiController]
    [Route("api/db-test")]
    public class DbTestController : ControllerBase
    {
        private readonly IDbConnectionFactory _connectionFactory;

        public DbTestController(IDbConnectionFactory connectionFactory)
        {
            _connectionFactory = connectionFactory;
        }

        [HttpGet("time")]
        public async Task<IActionResult> GetTime()
        {
            using var connection = _connectionFactory.CreateConnection();
            connection.Open();

            var dbTime = await connection.QuerySingleAsync<DateTime>(
                "SELECT NOW();"
            );

            return Ok(new
            {
                databaseTime = dbTime
            });
        }

    }
}