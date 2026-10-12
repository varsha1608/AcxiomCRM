using System;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AcxiomCrmApi.Data;
using AcxiomCrmApi.Models;

namespace AcxiomCrmApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class OpportunitiesController : ControllerBase
    {
        private readonly ApplicationDbContext _db;

        public OpportunitiesController(ApplicationDbContext db)
        {
            _db = db;
        }

        private string CurrentUserId => User.FindFirstValue(ClaimTypes.NameIdentifier) ?? string.Empty;
        private bool IsAdminOrManager => User.IsInRole("Admin") || User.IsInRole("Manager");

        [HttpGet]
        public async Task<IActionResult> GetOpportunities([FromQuery] string? stage, [FromQuery] string? status, [FromQuery] int page = 1, [FromQuery] int limit = 10)
        {
            var query = _db.Opportunities.AsQueryable();

            if (!IsAdminOrManager)
            {
                query = query.Where(o => o.AssignedToId == CurrentUserId || o.CreatedById == CurrentUserId);
            }

            if (!string.IsNullOrWhiteSpace(stage) && stage != "All")
            {
                query = query.Where(o => o.Stage == stage);
            }

            if (!string.IsNullOrWhiteSpace(status) && status != "All")
            {
                query = query.Where(o => o.Status == status);
            }

            var total = await query.CountAsync();
            var items = await query
                .OrderByDescending(o => o.CreatedAt)
                .Skip((page - 1) * limit)
                .Take(limit)
                .ToListAsync();

            return Ok(new
            {
                success = true,
                count = items.Count,
                total,
                totalPages = (int)Math.Ceiling((double)total / limit),
                currentPage = page,
                data = items
            });
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetOpportunityById(string id)
        {
            var opp = await _db.Opportunities.FindAsync(id);
            if (opp == null) return NotFound(new { success = false, message = "Opportunity not found" });

            if (!IsAdminOrManager && opp.AssignedToId != CurrentUserId && opp.CreatedById != CurrentUserId)
            {
                return StatusCode(403, new { success = false, message = "Access denied. You can only view opportunities assigned to you." });
            }

            return Ok(new { success = true, data = opp });
        }

        [HttpPost]
        public async Task<IActionResult> CreateOpportunity([FromBody] Opportunity input)
        {
            if (string.IsNullOrWhiteSpace(input.OpportunityName))
            {
                return BadRequest(new { success = false, message = "Opportunity name is required." });
            }

            if (input.Amount <= 0)
            {
                return BadRequest(new { success = false, message = "Opportunity Amount must be greater than 0." });
            }

            if (input.Probability < 0 || input.Probability > 100)
            {
                return BadRequest(new { success = false, message = "Probability must be between 0 and 100." });
            }

            if (input.Stage != "Won" && input.Stage != "Lost" && input.ExpectedCloseDate.Date < DateTime.UtcNow.Date)
            {
                return BadRequest(new { success = false, message = "Expected Close Date cannot be in the past." });
            }

            input.Id = Guid.NewGuid().ToString();
            input.CreatedById = CurrentUserId;
            if (string.IsNullOrWhiteSpace(input.AssignedToId)) input.AssignedToId = CurrentUserId;
            input.Status = input.Stage == "Won" ? "Won" : (input.Stage == "Lost" ? "Lost" : "Open");
            input.CreatedAt = DateTime.UtcNow;
            input.UpdatedAt = DateTime.UtcNow;

            _db.Opportunities.Add(input);
            await _db.SaveChangesAsync();

            return StatusCode(201, new { success = true, message = "Opportunity created successfully", data = input });
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateOpportunity(string id, [FromBody] Opportunity input)
        {
            var opp = await _db.Opportunities.FindAsync(id);
            if (opp == null) return NotFound(new { success = false, message = "Opportunity not found" });

            if (!IsAdminOrManager && opp.AssignedToId != CurrentUserId && opp.CreatedById != CurrentUserId)
            {
                return StatusCode(403, new { success = false, message = "Access denied. You can only update opportunities assigned to you." });
            }

            if (input.Amount > 0) opp.Amount = input.Amount;
            if (input.Probability >= 0 && input.Probability <= 100) opp.Probability = input.Probability;
            if (!string.IsNullOrWhiteSpace(input.Stage))
            {
                opp.Stage = input.Stage;
                opp.Status = input.Stage == "Won" ? "Won" : (input.Stage == "Lost" ? "Lost" : "Open");
            }
            if (input.ExpectedCloseDate != default) opp.ExpectedCloseDate = input.ExpectedCloseDate;
            opp.UpdatedAt = DateTime.UtcNow;

            await _db.SaveChangesAsync();
            return Ok(new { success = true, message = "Opportunity updated successfully", data = opp });
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteOpportunity(string id)
        {
            if (!IsAdminOrManager)
            {
                return StatusCode(403, new { success = false, message = "Sales Executives cannot delete opportunities." });
            }

            var opp = await _db.Opportunities.FindAsync(id);
            if (opp == null) return NotFound(new { success = false, message = "Opportunity not found" });

            _db.Opportunities.Remove(opp);
            await _db.SaveChangesAsync();

            return Ok(new { success = true, message = "Opportunity deleted successfully" });
        }
    }
}
