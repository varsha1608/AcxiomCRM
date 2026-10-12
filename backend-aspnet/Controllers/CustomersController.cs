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
    public class CustomersController : ControllerBase
    {
        private readonly ApplicationDbContext _db;

        public CustomersController(ApplicationDbContext db)
        {
            _db = db;
        }

        private string CurrentUserId => User.FindFirstValue(ClaimTypes.NameIdentifier) ?? string.Empty;
        private bool IsAdminOrManager => User.IsInRole("Admin") || User.IsInRole("Manager");

        [HttpGet]
        public async Task<IActionResult> GetCustomers([FromQuery] string? search, [FromQuery] string? status, [FromQuery] int page = 1, [FromQuery] int limit = 10)
        {
            var query = _db.Customers.AsQueryable();

            if (!IsAdminOrManager)
            {
                query = query.Where(c => c.AssignedToId == CurrentUserId || c.CreatedById == CurrentUserId);
            }

            if (!string.IsNullOrWhiteSpace(status) && status != "All")
            {
                query = query.Where(c => c.Status == status);
            }

            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim().ToLower();
                query = query.Where(c => c.CustomerName.ToLower().Contains(s) || c.Email.ToLower().Contains(s) || c.Phone.Contains(s));
            }

            var total = await query.CountAsync();
            var customers = await query
                .OrderByDescending(c => c.CreatedAt)
                .Skip((page - 1) * limit)
                .Take(limit)
                .ToListAsync();

            return Ok(new
            {
                success = true,
                count = customers.Count,
                total,
                totalPages = (int)Math.Ceiling((double)total / limit),
                currentPage = page,
                data = customers
            });
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetCustomerById(string id)
        {
            var customer = await _db.Customers.FindAsync(id);
            if (customer == null) return NotFound(new { success = false, message = "Customer not found" });

            if (!IsAdminOrManager && customer.AssignedToId != CurrentUserId && customer.CreatedById != CurrentUserId)
            {
                return StatusCode(403, new { success = false, message = "Access denied. You can only view customers assigned to you." });
            }

            return Ok(new { success = true, data = customer });
        }

        [HttpPost]
        public async Task<IActionResult> CreateCustomer([FromBody] Customer input)
        {
            if (string.IsNullOrWhiteSpace(input.CustomerName) || string.IsNullOrWhiteSpace(input.Email) || string.IsNullOrWhiteSpace(input.Phone))
            {
                return BadRequest(new { success = false, message = "Name, email and phone are mandatory." });
            }

            if (await _db.Customers.AnyAsync(c => c.Email.ToLower() == input.Email.Trim().ToLower()))
            {
                return Conflict(new { success = false, message = "A customer with this email already exists." });
            }

            if (await _db.Customers.AnyAsync(c => c.Phone == input.Phone.Trim()))
            {
                return Conflict(new { success = false, message = "A customer with this phone already exists." });
            }

            input.Id = Guid.NewGuid().ToString();
            input.CustomerCode = $"CUST-{DateTime.UtcNow:yyMMdd}-{Random.Shared.Next(1000, 9999)}";
            input.CreatedById = CurrentUserId;
            if (string.IsNullOrWhiteSpace(input.AssignedToId)) input.AssignedToId = CurrentUserId;
            input.CreatedAt = DateTime.UtcNow;
            input.UpdatedAt = DateTime.UtcNow;

            _db.Customers.Add(input);
            await _db.SaveChangesAsync();

            return StatusCode(201, new { success = true, message = "Customer created successfully", data = input });
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateCustomer(string id, [FromBody] Customer input)
        {
            var customer = await _db.Customers.FindAsync(id);
            if (customer == null) return NotFound(new { success = false, message = "Customer not found" });

            if (!IsAdminOrManager && customer.AssignedToId != CurrentUserId && customer.CreatedById != CurrentUserId)
            {
                return StatusCode(403, new { success = false, message = "Access denied. You can only update customers assigned to you." });
            }

            if (!string.IsNullOrWhiteSpace(input.CustomerName)) customer.CustomerName = input.CustomerName.Trim();
            if (!string.IsNullOrWhiteSpace(input.CompanyName)) customer.CompanyName = input.CompanyName.Trim();
            if (!string.IsNullOrWhiteSpace(input.Status)) customer.Status = input.Status;
            customer.UpdatedAt = DateTime.UtcNow;

            await _db.SaveChangesAsync();
            return Ok(new { success = true, message = "Customer updated successfully", data = customer });
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteCustomer(string id)
        {
            if (!IsAdminOrManager)
            {
                return StatusCode(403, new { success = false, message = "Sales Executives cannot delete customers." });
            }

            var customer = await _db.Customers.FindAsync(id);
            if (customer == null) return NotFound(new { success = false, message = "Customer not found" });

            _db.Customers.Remove(customer);
            await _db.SaveChangesAsync();

            return Ok(new { success = true, message = "Customer deleted successfully" });
        }
    }
}
