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
    public class LeadsController : ControllerBase
    {
        private readonly ApplicationDbContext _db;

        public LeadsController(ApplicationDbContext db)
        {
            _db = db;
        }

        private string CurrentUserId => User.FindFirstValue(ClaimTypes.NameIdentifier) ?? string.Empty;
        private bool IsAdminOrManager => User.IsInRole("Admin") || User.IsInRole("Manager");

        public class ConvertLeadModel
        {
            public bool CreateCustomer { get; set; } = true;
            public bool CreateOpportunity { get; set; } = true;
            public string? OpportunityName { get; set; }
            public decimal OpportunityAmount { get; set; }
            public string OpportunityStage { get; set; } = "Qualification";
            public DateTime? ExpectedCloseDate { get; set; }
        }

        [HttpGet]
        public async Task<IActionResult> GetLeads([FromQuery] string? status, [FromQuery] int page = 1, [FromQuery] int limit = 10)
        {
            var query = _db.Leads.AsQueryable();

            if (!IsAdminOrManager)
            {
                query = query.Where(l => l.AssignedToId == CurrentUserId || l.CreatedById == CurrentUserId);
            }

            if (!string.IsNullOrWhiteSpace(status) && status != "All")
            {
                query = query.Where(l => l.Status == status);
            }

            var total = await query.CountAsync();
            var items = await query
                .OrderByDescending(l => l.CreatedAt)
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
        public async Task<IActionResult> GetLeadById(string id)
        {
            var lead = await _db.Leads.FindAsync(id);
            if (lead == null) return NotFound(new { success = false, message = "Lead not found" });

            if (!IsAdminOrManager && lead.AssignedToId != CurrentUserId && lead.CreatedById != CurrentUserId)
            {
                return StatusCode(403, new { success = false, message = "Access denied. You can only view leads assigned to you." });
            }

            return Ok(new { success = true, data = lead });
        }

        [HttpPost]
        public async Task<IActionResult> CreateLead([FromBody] Lead input)
        {
            if (string.IsNullOrWhiteSpace(input.LeadName) || string.IsNullOrWhiteSpace(input.Email) || string.IsNullOrWhiteSpace(input.Phone))
            {
                return BadRequest(new { success = false, message = "Name, email and phone are mandatory." });
            }

            input.Id = Guid.NewGuid().ToString();
            input.LeadCode = $"LEAD-{DateTime.UtcNow:yyMMdd}-{Random.Shared.Next(1000, 9999)}";
            input.CreatedById = CurrentUserId;
            if (string.IsNullOrWhiteSpace(input.AssignedToId)) input.AssignedToId = CurrentUserId;
            input.CreatedAt = DateTime.UtcNow;
            input.UpdatedAt = DateTime.UtcNow;

            _db.Leads.Add(input);
            await _db.SaveChangesAsync();

            return StatusCode(201, new { success = true, message = "Lead created successfully", data = input });
        }

        [HttpPost("{id}/convert")]
        public async Task<IActionResult> ConvertLead(string id, [FromBody] ConvertLeadModel model)
        {
            var lead = await _db.Leads.FindAsync(id);
            if (lead == null) return NotFound(new { success = false, message = "Lead not found" });

            if (!IsAdminOrManager && lead.AssignedToId != CurrentUserId && lead.CreatedById != CurrentUserId)
            {
                return StatusCode(403, new { success = false, message = "Access denied. You can only convert leads assigned to you." });
            }

            if (lead.Status == "Converted")
            {
                return BadRequest(new { success = false, message = "This lead has already been converted." });
            }

            Customer? customer = null;
            Opportunity? opportunity = null;

            if (model.CreateCustomer)
            {
                customer = await _db.Customers.FirstOrDefaultAsync(c => c.Email.ToLower() == lead.Email.ToLower());
                if (customer == null)
                {
                    customer = new Customer
                    {
                        Id = Guid.NewGuid().ToString(),
                        CustomerCode = $"CUST-{DateTime.UtcNow:yyMMdd}-{Random.Shared.Next(1000, 9999)}",
                        CustomerName = lead.LeadName,
                        Email = lead.Email,
                        Phone = lead.Phone,
                        CompanyName = lead.CompanyName,
                        Status = "Active",
                        AssignedToId = lead.AssignedToId,
                        CreatedById = CurrentUserId
                    };
                    _db.Customers.Add(customer);
                    await _db.SaveChangesAsync();
                }
                lead.ConvertedCustomerId = customer.Id;
            }

            if (model.CreateOpportunity && customer != null)
            {
                opportunity = new Opportunity
                {
                    Id = Guid.NewGuid().ToString(),
                    OpportunityName = model.OpportunityName ?? $"{lead.LeadName} Deal",
                    CustomerId = customer.Id,
                    LeadId = lead.Id,
                    Amount = model.OpportunityAmount > 0 ? model.OpportunityAmount : (lead.ExpectedValue > 0 ? lead.ExpectedValue : 1000),
                    Stage = model.OpportunityStage,
                    Probability = 20,
                    ExpectedCloseDate = model.ExpectedCloseDate ?? DateTime.UtcNow.AddDays(30),
                    Status = "Open",
                    AssignedToId = lead.AssignedToId,
                    CreatedById = CurrentUserId
                };
                _db.Opportunities.Add(opportunity);
                await _db.SaveChangesAsync();
                lead.ConvertedOpportunityId = opportunity.Id;
            }

            lead.Status = "Converted";
            lead.ConvertedAt = DateTime.UtcNow;
            lead.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            return Ok(new
            {
                success = true,
                message = "Lead converted successfully",
                data = new { lead, customer, opportunity }
            });
        }
    }
}
