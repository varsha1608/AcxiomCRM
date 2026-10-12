using System;
using System.ComponentModel.DataAnnotations;

namespace AcxiomCrmApi.Models
{
    public class Customer
    {
        [Key]
        public string Id { get; set; } = Guid.NewGuid().ToString();

        [MaxLength(50)]
        public string CustomerCode { get; set; } = string.Empty;

        [Required]
        [MaxLength(150)]
        public string CustomerName { get; set; } = string.Empty;

        [Required]
        [EmailAddress]
        [MaxLength(150)]
        public string Email { get; set; } = string.Empty;

        [Required]
        [MaxLength(30)]
        public string Phone { get; set; } = string.Empty;

        public string CompanyName { get; set; } = string.Empty;
        public string Address { get; set; } = string.Empty;
        public string City { get; set; } = string.Empty;
        public string State { get; set; } = string.Empty;
        public string Status { get; set; } = "Active"; // Active, Inactive
        public string Notes { get; set; } = string.Empty;

        public string AssignedToId { get; set; } = string.Empty;
        public string CreatedById { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }

    public class Lead
    {
        [Key]
        public string Id { get; set; } = Guid.NewGuid().ToString();

        [MaxLength(50)]
        public string LeadCode { get; set; } = string.Empty;

        [Required]
        [MaxLength(150)]
        public string LeadName { get; set; } = string.Empty;

        [Required]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;

        [Required]
        public string Phone { get; set; } = string.Empty;

        public string CompanyName { get; set; } = string.Empty;
        public string Source { get; set; } = "Website";
        public string Status { get; set; } = "New"; // New, Contacted, Qualified, Unqualified, Converted, Lost
        public string Priority { get; set; } = "Medium";
        public decimal ExpectedValue { get; set; } = 0;

        public string AssignedToId { get; set; } = string.Empty;
        public string CreatedById { get; set; } = string.Empty;
        public string? ConvertedCustomerId { get; set; }
        public string? ConvertedOpportunityId { get; set; }
        public DateTime? ConvertedAt { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }

    public class Opportunity
    {
        [Key]
        public string Id { get; set; } = Guid.NewGuid().ToString();

        [Required]
        [MaxLength(200)]
        public string OpportunityName { get; set; } = string.Empty;

        [Required]
        public string CustomerId { get; set; } = string.Empty;
        public string? LeadId { get; set; }

        [Range(0.01, double.MaxValue, ErrorMessage = "Amount must be greater than 0")]
        public decimal Amount { get; set; }

        [Required]
        public string Stage { get; set; } = "Qualification"; // Qualification, Proposal, Negotiation, Won, Lost

        [Range(0, 100, ErrorMessage = "Probability must be between 0 and 100")]
        public int Probability { get; set; } = 20;

        [Required]
        public DateTime ExpectedCloseDate { get; set; }

        public string Status { get; set; } = "Open"; // Open, Won, Lost
        public string AssignedToId { get; set; } = string.Empty;
        public string CreatedById { get; set; } = string.Empty;
        public string Notes { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }

    public class FollowUp
    {
        [Key]
        public string Id { get; set; } = Guid.NewGuid().ToString();

        public string RelatedType { get; set; } = "Customer"; // Customer, Lead
        public string? CustomerId { get; set; }
        public string? LeadId { get; set; }

        [Required]
        public DateTime FollowUpDate { get; set; }

        public string FollowUpType { get; set; } = "Call"; // Call, Meeting, Email
        [Required]
        public string Subject { get; set; } = string.Empty;
        public string Remarks { get; set; } = string.Empty;
        public string Status { get; set; } = "Planned"; // Planned, Completed, Missed, Cancelled

        public string AssignedToId { get; set; } = string.Empty;
        public string CreatedById { get; set; } = string.Empty;
        public DateTime? CompletedAt { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    public class ActivityRecord
    {
        [Key]
        public string Id { get; set; } = Guid.NewGuid().ToString();

        public string ActivityType { get; set; } = "Call";
        [Required]
        public string Subject { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public DateTime ActivityDate { get; set; } = DateTime.UtcNow;

        public string? CustomerId { get; set; }
        public string? LeadId { get; set; }
        public string AssignedToId { get; set; } = string.Empty;
        public string CreatedById { get; set; } = string.Empty;
        public string Status { get; set; } = "Completed";
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    public class AuditLogRecord
    {
        [Key]
        public string Id { get; set; } = Guid.NewGuid().ToString();

        public string? UserId { get; set; }
        public string UserName { get; set; } = "System";
        public string UserRole { get; set; } = "Anonymous";
        public string Action { get; set; } = string.Empty;
        public string EntityName { get; set; } = string.Empty;
        public string RecordId { get; set; } = string.Empty;
        public string Details { get; set; } = string.Empty;
        public string Result { get; set; } = "SUCCESS";
        public string? OldValue { get; set; }
        public string? NewValue { get; set; }
        public string IpAddress { get; set; } = "127.0.0.1";
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
