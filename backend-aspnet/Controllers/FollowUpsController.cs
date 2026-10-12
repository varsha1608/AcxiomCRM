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
    public class FollowUpsController : ControllerBase
    {
        private readonly ApplicationDbContext _db;

        public FollowUpsController(ApplicationDbContext db)
        {
            _db = db;
        }

        private string CurrentUserId => User.FindFirstValue(ClaimTypes.NameIdentifier) ?? string.Empty;
        private bool IsAdminOrManager => User.IsInRole("Admin") || User.IsInRole("Manager");

        [HttpGet]
        public async Task<IActionResult> GetFollowUps([FromQuery] string? status)
        {
            var query = _db.FollowUps.AsQueryable();

            if (!IsAdminOrManager)
            {
                query = query.Where(f => f.AssignedToId == CurrentUserId || f.CreatedById == CurrentUserId);
            }

            if (!string.IsNullOrWhiteSpace(status) && status != "All")
            {
                query = query.Where(f => f.Status == status);
            }

            var list = await query.OrderBy(f => f.FollowUpDate).ToListAsync();
            return Ok(new { success = true, count = list.Count, data = list });
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetFollowUpById(string id)
        {
            var fu = await _db.FollowUps.FindAsync(id);
            if (fu == null) return NotFound(new { success = false, message = "Follow-up not found" });

            if (!IsAdminOrManager && fu.AssignedToId != CurrentUserId && fu.CreatedById != CurrentUserId)
            {
                return StatusCode(403, new { success = false, message = "Access denied. You can only view follow-ups assigned to you." });
            }

            return Ok(new { success = true, data = fu });
        }

        [HttpPost]
        public async Task<IActionResult> CreateFollowUp([FromBody] FollowUp input)
        {
            if (string.IsNullOrWhiteSpace(input.Subject))
            {
                return BadRequest(new { success = false, message = "Subject is required." });
            }

            if (input.Status == "Planned" && input.FollowUpDate.Date < DateTime.UtcNow.Date)
            {
                return BadRequest(new { success = false, message = "Follow-up date cannot be earlier than today." });
            }

            input.Id = Guid.NewGuid().ToString();
            input.CreatedById = CurrentUserId;
            if (string.IsNullOrWhiteSpace(input.AssignedToId)) input.AssignedToId = CurrentUserId;
            input.CreatedAt = DateTime.UtcNow;

            _db.FollowUps.Add(input);
            await _db.SaveChangesAsync();

            return StatusCode(201, new { success = true, message = "Follow-up scheduled successfully", data = input });
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateFollowUp(string id, [FromBody] FollowUp input)
        {
            var fu = await _db.FollowUps.FindAsync(id);
            if (fu == null) return NotFound(new { success = false, message = "Follow-up not found" });

            if (!IsAdminOrManager && fu.AssignedToId != CurrentUserId && fu.CreatedById != CurrentUserId)
            {
                return StatusCode(403, new { success = false, message = "Access denied. You can only update follow-ups assigned to you." });
            }

            if (!string.IsNullOrWhiteSpace(input.Subject)) fu.Subject = input.Subject.Trim();
            if (!string.IsNullOrWhiteSpace(input.Status))
            {
                fu.Status = input.Status;
                if (input.Status == "Completed" && !fu.CompletedAt.HasValue) fu.CompletedAt = DateTime.UtcNow;
            }
            if (input.FollowUpDate != default) fu.FollowUpDate = input.FollowUpDate;
            if (!string.IsNullOrWhiteSpace(input.Remarks)) fu.Remarks = input.Remarks;

            await _db.SaveChangesAsync();
            return Ok(new { success = true, message = "Follow-up updated successfully", data = fu });
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteFollowUp(string id)
        {
            var fu = await _db.FollowUps.FindAsync(id);
            if (fu == null) return NotFound(new { success = false, message = "Follow-up not found" });

            if (!IsAdminOrManager && fu.AssignedToId != CurrentUserId && fu.CreatedById != CurrentUserId)
            {
                return StatusCode(403, new { success = false, message = "Access denied. You can only delete follow-ups assigned to you." });
            }

            _db.FollowUps.Remove(fu);
            await _db.SaveChangesAsync();

            return Ok(new { success = true, message = "Follow-up deleted successfully" });
        }
    }
}
