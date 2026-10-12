using System;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using AcxiomCrmApi.Models;

namespace AcxiomCrmApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly SignInManager<ApplicationUser> _signInManager;
        private readonly RoleManager<IdentityRole> _roleManager;
        private readonly IConfiguration _configuration;

        public AuthController(
            UserManager<ApplicationUser> userManager,
            SignInManager<ApplicationUser> signInManager,
            RoleManager<IdentityRole> roleManager,
            IConfiguration configuration)
        {
            _userManager = userManager;
            _signInManager = signInManager;
            _roleManager = roleManager;
            _configuration = configuration;
        }

        public class RegisterModel
        {
            public string Name { get; set; } = string.Empty;
            public string Email { get; set; } = string.Empty;
            public string Password { get; set; } = string.Empty;
            public string? Role { get; set; }
            public string? Phone { get; set; }
            public string? Department { get; set; }
        }

        public class LoginModel
        {
            public string Email { get; set; } = string.Empty;
            public string Password { get; set; } = string.Empty;
        }

        [HttpPost("register")]
        [AllowAnonymous]
        public async Task<IActionResult> Register([FromBody] RegisterModel model)
        {
            if (string.IsNullOrWhiteSpace(model.Name) ||
                string.IsNullOrWhiteSpace(model.Email) ||
                string.IsNullOrWhiteSpace(model.Password))
            {
                return BadRequest(new { success = false, message = "Name, email and password are required." });
            }

            var existingUser = await _userManager.FindByEmailAsync(model.Email);
            if (existingUser != null)
            {
                return Conflict(new { success = false, message = "A user with this email already exists." });
            }

            var user = new ApplicationUser
            {
                UserName = model.Email.Trim().ToLowerInvariant(),
                Email = model.Email.Trim().ToLowerInvariant(),
                FullName = model.Name.Trim(),
                PhoneNumber = model.Phone?.Trim() ?? string.Empty,
                Department = model.Department?.Trim() ?? "Sales",
                EmailConfirmed = true,
                LockoutEnabled = true
            };

            var result = await _userManager.CreateAsync(user, model.Password);
            if (!result.Succeeded)
            {
                var errors = string.Join("; ", result.Errors.Select(e => e.Description));
                return BadRequest(new { success = false, message = errors });
            }

            // Public Registration Privilege Escalation Prevention:
            // Public callers are NEVER granted Admin or Manager. Assigned least-privileged 'Sales Executive'.
            var roleToAssign = "Sales Executive";
            if (!await _roleManager.RoleExistsAsync(roleToAssign))
            {
                await _roleManager.CreateAsync(new IdentityRole(roleToAssign));
            }
            await _userManager.AddToRoleAsync(user, roleToAssign);

            var token = GenerateJwtToken(user, roleToAssign);

            return StatusCode(201, new
            {
                success = true,
                token,
                user = new
                {
                    id = user.Id,
                    name = user.FullName,
                    userName = user.UserName,
                    email = user.Email,
                    role = roleToAssign,
                    department = user.Department
                }
            });
        }

        [HttpPost("login")]
        [AllowAnonymous]
        public async Task<IActionResult> Login([FromBody] LoginModel model)
        {
            if (string.IsNullOrWhiteSpace(model.Email) || string.IsNullOrWhiteSpace(model.Password))
            {
                return BadRequest(new { success = false, message = "Please provide both email and password." });
            }

            var user = await _userManager.FindByEmailAsync(model.Email.Trim().ToLowerInvariant());
            if (user == null)
            {
                return Unauthorized(new { success = false, message = "Invalid email or password." });
            }

            if (!user.IsActive)
            {
                return StatusCode(403, new { success = false, message = "Your account has been deactivated." });
            }

            // ASP.NET Core Identity Lockout Check
            if (await _userManager.IsLockedOutAsync(user))
            {
                var lockoutEnd = await _userManager.GetLockoutEndDateAsync(user);
                var minutes = lockoutEnd.HasValue ? Math.Ceiling((lockoutEnd.Value - DateTimeOffset.UtcNow).TotalMinutes) : 15;
                return StatusCode(403, new
                {
                    success = false,
                    message = $"Account is locked out due to multiple failed login attempts. Try again in {minutes} minute(s)."
                });
            }

            // Genuine ASP.NET Core SignInManager Password Check with Lockout Tracking
            var signInResult = await _signInManager.CheckPasswordSignInAsync(user, model.Password, lockoutOnFailure: true);

            if (signInResult.IsLockedOut)
            {
                return StatusCode(403, new
                {
                    success = false,
                    message = "Account locked out due to consecutive failed login attempts."
                });
            }

            if (!signInResult.Succeeded)
            {
                var failedCount = await _userManager.GetAccessFailedCountAsync(user);
                return Unauthorized(new
                {
                    success = false,
                    message = $"Invalid email or password. Attempt {failedCount} of 5 before account lockout."
                });
            }

            // Reset failed count on successful sign in
            await _userManager.ResetAccessFailedCountAsync(user);

            var roles = await _userManager.GetRolesAsync(user);
            var primaryRole = roles.FirstOrDefault() ?? "Sales Executive";
            var token = GenerateJwtToken(user, primaryRole);

            return Ok(new
            {
                success = true,
                token,
                user = new
                {
                    id = user.Id,
                    name = user.FullName,
                    userName = user.UserName,
                    email = user.Email,
                    role = primaryRole,
                    department = user.Department
                }
            });
        }

        [HttpPost("logout")]
        [Authorize]
        public async Task<IActionResult> Logout()
        {
            await _signInManager.SignOutAsync();
            return Ok(new { success = true, message = "Logged out successfully" });
        }

        [HttpGet("me")]
        [Authorize]
        public async Task<IActionResult> GetMe()
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null) return Unauthorized();

            var roles = await _userManager.GetRolesAsync(user);
            return Ok(new
            {
                success = true,
                user = new
                {
                    id = user.Id,
                    name = user.FullName,
                    userName = user.UserName,
                    email = user.Email,
                    role = roles.FirstOrDefault() ?? "Sales Executive",
                    department = user.Department
                }
            });
        }

        private string GenerateJwtToken(ApplicationUser user, string role)
        {
            var jwtKey = _configuration["Jwt:Secret"] ?? "acxiom_crm_jwt_super_secret_key_2026_secure";
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var claims = new[]
            {
                new Claim(JwtRegisteredClaimNames.Sub, user.Id),
                new Claim(JwtRegisteredClaimNames.Email, user.Email ?? string.Empty),
                new Claim(ClaimTypes.NameIdentifier, user.Id),
                new Claim(ClaimTypes.Name, user.FullName),
                new Claim(ClaimTypes.Role, role)
            };

            var token = new JwtSecurityToken(
                claims: claims,
                expires: DateTime.UtcNow.AddDays(7),
                signingCredentials: creds
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }
}
