using System;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using AcxiomCrmApi.Data;
using AcxiomCrmApi.Models;

var builder = WebApplication.CreateBuilder(args);

// 1. Configure EF Core with SQLite
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection") ?? "Data Source=acxiomcrm.db"));

// 2. Configure ASP.NET Core Identity
builder.Services.AddIdentity<ApplicationUser, IdentityRole>(options =>
{
    // Configurable Password Policy
    options.Password.RequiredLength = 8;
    options.Password.RequireUppercase = true;
    options.Password.RequireLowercase = true;
    options.Password.RequireDigit = true;
    options.Password.RequireNonAlphanumeric = false;

    // Account Lockout Policy
    options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
    options.Lockout.MaxFailedAccessAttempts = 5;
    options.Lockout.AllowedForNewUsers = true;

    // User settings
    options.User.RequireUniqueEmail = true;
})
.AddEntityFrameworkStores<ApplicationDbContext>()
.AddDefaultTokenProviders();

// 3. Configure JWT Authentication
var jwtSecret = builder.Configuration["Jwt:Secret"] ?? "acxiom_crm_jwt_super_secret_key_2026_secure";
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = false;
    options.SaveToken = true;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
        ValidateIssuer = false,
        ValidateAudience = false,
        ClockSkew = TimeSpan.Zero
    };
});

// 4. Configure CORS
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins("http://localhost:3000", "http://127.0.0.1:3000")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

var app = builder.Build();

// Ensure Database & Seed Roles & Users
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    db.Database.EnsureCreated();

    var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
    var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();

    string[] roles = ["Admin", "Manager", "Sales Executive"];
    foreach (var r in roles)
    {
        if (!await roleManager.RoleExistsAsync(r))
        {
            await roleManager.CreateAsync(new IdentityRole(r));
        }
    }

    // Seed Admin
    var adminEmail = "admin@acxiomcrm.com";
    if (await userManager.FindByEmailAsync(adminEmail) == null)
    {
        var admin = new ApplicationUser
        {
            UserName = adminEmail,
            Email = adminEmail,
            FullName = "CRM Administrator",
            Department = "IT & Administration",
            EmailConfirmed = true,
            LockoutEnabled = true
        };
        var res = await userManager.CreateAsync(admin, "Admin@12345");
        if (res.Succeeded)
        {
            await userManager.AddToRoleAsync(admin, "Admin");
        }
    }

    // Seed Manager
    var managerEmail = "manager@acxiomcrm.com";
    if (await userManager.FindByEmailAsync(managerEmail) == null)
    {
        var manager = new ApplicationUser
        {
            UserName = managerEmail,
            Email = managerEmail,
            FullName = "Sarah Jenkins",
            Department = "Enterprise Sales",
            EmailConfirmed = true,
            LockoutEnabled = true
        };
        var res = await userManager.CreateAsync(manager, "Manager@12345");
        if (res.Succeeded)
        {
            await userManager.AddToRoleAsync(manager, "Manager");
        }
    }

    // Seed Sales Executive
    var salesEmail = "sales@acxiomcrm.com";
    if (await userManager.FindByEmailAsync(salesEmail) == null)
    {
        var sales = new ApplicationUser
        {
            UserName = salesEmail,
            Email = salesEmail,
            FullName = "David Miller",
            Department = "Direct Sales",
            EmailConfirmed = true,
            LockoutEnabled = true
        };
        var res = await userManager.CreateAsync(sales, "Sales@12345");
        if (res.Succeeded)
        {
            await userManager.AddToRoleAsync(sales, "Sales Executive");
        }
    }
}

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.MapGet("/api/health", () => Results.Ok(new { status = "Healthy", framework = "ASP.NET Core 8.0 Identity", timestamp = DateTime.UtcNow }));

app.Run();
