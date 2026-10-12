using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AcxiomCrmApi.Models;

namespace AcxiomCrmApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class UsersController : ControllerBase
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly RoleManager<IdentityRole> _roleManager;

        public UsersController(
            UserManager<ApplicationUser> userManager,
            RoleManager<IdentityRole> roleManager)
        {
            _userManager = userManager;
            _roleManager = roleManager;
        }

        [HttpGet("assignable")]
        public async Task<IActionResult> GetAssignable()
        {
            var users = await _userManager.Users
                .Where(u => u.IsActive)
                .Select(u => new
                {
                    id = u.Id,
                    name = u.FullName,
                    email = u.Email,
                    department = u.Department
                })
                .ToListAsync();

            return Ok(new { success = true, data = users });
        }

        [HttpGet]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetUsers([FromQuery] string? search)
        {
            var query = _userManager.Users.AsQueryable();

            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim().ToLower();
                query = query.Where(u => u.FullName.ToLower().Contains(s) || (u.Email != null && u.Email.ToLower().Contains(s)));
            }

            var users = await query.ToListAsync();
            var list = new List<object>();

            foreach (var u in users)
            {
                var roles = await _userManager.GetRolesAsync(u);
                var isLocked = await _userManager.IsLockedOutAsync(u);
                list.Add(new
                {
                    id = u.Id,
                    name = u.FullName,
                    userName = u.UserName,
                    email = u.Email,
                    role = roles.FirstOrDefault() ?? "Sales Executive",
                    department = u.Department,
                    isActive = u.IsActive,
                    isLockedOut = isLocked,
                    failedLoginCount = u.AccessFailedCount
                });
            }

            return Ok(new { success = true, data = list });
        }

        [HttpPost("{id}/unlock")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> UnlockUser(string id)
        {
            var user = await _userManager.FindByIdAsync(id);
            if (user == null) return NotFound(new { success = false, message = "User not found" });

            await _userManager.SetLockoutEndDateAsync(user, null);
            await _userManager.ResetAccessFailedCountAsync(user);

            return Ok(new { success = true, message = $"Account for {user.Email} successfully unlocked." });
        }
    }
}
