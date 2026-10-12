# AcxiomCRM — Enterprise Customer Relationship Management System

**AcxiomCRM** is a production-grade, secure, full-stack Customer Relationship Management (CRM) web application designed for enterprise sales and management teams. Built with the **MERN** stack (MongoDB, Express.js, React, Node.js) and styled with Tailwind CSS, it satisfies all functional, validation, security, and reporting specifications outlined in the project documentation.

---

## Architecture Overview

```
                                Users
                                  │
                                  ▼
      ┌────────────────────────────────────────────────────────┐
      │          Presentation Layer (React + Vite)             │
      │  Dark Navy Sidebar | Tailwind CSS | Chart.js | Lucide  │
      └───────────────────────────┬────────────────────────────┘
                                  │ REST API (JWT Bearer Token)
                                  ▼
      ┌────────────────────────────────────────────────────────┐
      │           Application Layer (Express.js API)           │
      │  Controllers | DTOs | Request Validation | Rate Limiter │
      └───────────────────────────┬────────────────────────────┘
                                  │
                                  ▼
      ┌────────────────────────────────────────────────────────┐
      │          Business & Security Layer (Middleware)        │
      │   RBAC (Admin/Manager/Sales) | Lockout Policy | Audits │
      └───────────────────────────┬────────────────────────────┘
                                  │
                                  ▼
      ┌────────────────────────────────────────────────────────┐
      │           Data Access & Storage Layer (MongoDB)        │
      │   Mongoose Schemas | Unique Indexes | Tamper-Proof Log │
      └────────────────────────────────────────────────────────┘
```

---

## Key Modules & Capabilities

### 1. Security & Authentication
- **Secure Password Hashing**: Hashed using `bcryptjs` with salt rounds. Plaintext passwords are never stored or returned.
- **Strict Password Policy**: Minimum 8 characters; requires at least one letter and one number.
- **Account Lockout Protection**: Automatically locks user accounts for 15 minutes after 5 consecutive failed login attempts. Unlocks automatically upon timeout or by Admin intervention.
- **JWT Session Tokens**: Signed tokens with configured expiration and role claims.
- **Rate Limiting**: Brute-force protection enabled on authentication endpoints.

### 2. Role-Based Access Control (RBAC)
- **Admin**: Full system access, User & Role administration, account unlock, password reset, append-only Audit Log access, all CRM data and intelligence reports.
- **Manager**: Team-wide customer/lead/opportunity oversight, pipeline tracking, and management reports.
- **Sales Executive**: Scoped access restricted to assigned customers, leads, opportunities, follow-ups, and personal sales reports.

### 3. Executive Dashboard
- **Live KPI Metrics**: Total Customers, Total Leads, Open Leads, Total Opportunities, Open Deals, Closed Won, Closed Lost, Total Pipeline Value, Weighted Forecast, and Pending Follow-Ups.
- **Chart.js Visualizations**:
  1. *Lead Status Breakdown* (Doughnut Chart: New, Contacted, Qualified, Unqualified, Converted, Lost)
  2. *Opportunity Sales Pipeline* (Bar Chart: Qualification, Proposal, Negotiation, Won, Lost)
  3. *Monthly Won Sales Trend* (Line Chart: Revenue growth over time)
- **Timeframe Filtering**: Filter dashboard metrics by All Time, Today, This Week, or This Month.
- **Stream Feeds**: Upcoming follow-ups and recent CRM activity streams.

### 4. Customer Management
- Complete CRUD with auto-generated code (`CUST-1001`, `CUST-1002`, etc.).
- **Validation**:
  - Customer name required (max 100 characters).
  - Valid RFC email format.
  - Valid telephone format (7–20 characters).
  - **Uniqueness Guarantee**: Duplicate emails and phone numbers are strictly rejected on client and server (HTTP 409).
- **Customer 360 View**: Modal displaying connected opportunities, follow-up history, and activity logs.

### 5. Lead Management & Conversion Workflow
- Track leads with priority, expected value, source channel, and qualification status.
- **1-Click Conversion Workflow**: Converts qualified leads directly into permanent Customer accounts and active Sales Pipeline Opportunities, recording the transition in the audit history.

### 6. Opportunity & Pipeline Management
- Stages: `Qualification`, `Proposal`, `Negotiation`, `Won`, and `Lost`.
- **Business Validations**:
  - Deal amount must be strictly greater than 0.
  - Probability must be between 0% and 100%.
  - Expected close date cannot be in the past for active deals.
- **Weighted Forecast Engine**: Automatically calculates weighted pipeline value (`Amount × Probability ÷ 100`).

### 7. Follow-Up Scheduling & Reminders
- Schedule client follow-ups across Calls, Meetings, Emails, Demos, and Tasks.
- **Date Validation**: New/planned follow-up dates cannot be earlier than today.
- Tabs for *All Tasks*, *Upcoming*, *Today*, and *Overdue*.
- 1-click status actions (Completed, Missed, Rescheduled).

### 8. User Administration (Admin Exclusive)
- User provisioning with role assignment (`Admin`, `Manager`, `Sales Executive`).
- Account activation and deactivation toggle.
- Lockout status monitor with instant 1-click account unlock.
- Administrator password reset with policy enforcement.

### 9. Tamper-Proof Audit Logging (Admin Exclusive)
- Immutable, append-only audit trail logging user, role, action, module, record ID, IP address, result, and timestamp.
- Intercepts state mutations: `LOGIN`, `FAILED_LOGIN`, `LOCKOUT`, `UNLOCK`, `CREATE`, `UPDATE`, `DELETE`, and `CONVERT_LEAD`.
- Interactive JSON diff modal inspecting previous state vs new state.

### 10. Intelligence Reports & CSV Export
- Reports: Customer Report, Lead Report, Follow-Up Report, Pipeline Breakdown, Conversion & Win-Rate Funnel, User Activity Report, and Security Audit Report.
- One-click **Export to CSV** utility on any report view.

---

## Pre-Configured Demo Accounts

The project includes pre-seeded demo accounts for each CRM role:

| Role | Email | Password | Access Scope |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@acxiomcrm.com` | `Admin@12345` | Full system, Users, Audit Logs, All CRM data |
| **Manager** | `manager@acxiomcrm.com` | `Manager@12345` | Team pipeline, deals, reports, CRM records |
| **Sales Executive** | `sales@acxiomcrm.com` | `Sales@12345` | Assigned records, follow-ups, personal dashboard |

> **Tip**: The login page contains one-click demo login buttons to switch between roles instantly.

---

## Setup & Running Instructions

### 1. Prerequisites
- **Node.js**: v18+ (verified on v24.18.0)
- **MongoDB**: Local MongoDB instance (`mongodb://127.0.0.1:27017`) or MongoDB Atlas URI

### 2. Environment Configuration
Create or verify `server/.env`:
```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/acxiomcrm
JWT_SECRET=acxiom_crm_jwt_super_secret_key_2026_secure
JWT_EXPIRES_IN=7d
LOCKOUT_MAX_ATTEMPTS=5
LOCKOUT_DURATION_MINUTES=15
```

> **For MongoDB Atlas**: Replace `MONGO_URI` with your connection string:
> `mongodb+srv://<username>:<password>@<cluster>.mongodb.net/acxiomcrm?retryWrites=true&w=majority`

### 3. Database Seeding
To populate realistic sample accounts, customers, leads, opportunities, follow-ups, and audit records:
```bash
cd server
npm run seed
```

### 4. Running the Application

Open two terminal windows:

#### Terminal 1 — Start Backend Server:
```bash
cd server
npm start
```
*Backend runs on `http://localhost:5000`*

#### Terminal 2 — Start Frontend Client:
```bash
cd client
npm run dev
```
*Frontend runs on `http://localhost:3000`*

---

## Automated Acceptance Test Suite

To verify all 22 acceptance criteria, business rules, validations, and security policies automatically:

```bash
cd server
node test-suite.js
```

### Test Verification Results:
```
========================================
   ACXIOMCRM COMPREHENSIVE TEST SUITE
========================================
  [PASS] 1. System Health API check
  [PASS] 2. Password policy: rejection of password < 8 characters
  [PASS] 3. Admin Authentication & JWT token issuance
  [PASS] 4. Sales Executive Authentication
  [PASS] 5. Security: Account lockout triggered after consecutive failed attempts
  [PASS] 6. Admin Security: Successfully unlocked user account
  [PASS] 7. Customer Validation: Rejected invalid email format
  [PASS] 8. Customer Management: Created customer record
  [PASS] 9. Customer Validation: Prevented duplicate email creation (409 Conflict)
  [PASS] 10. Lead Management: Successfully captured qualified lead
  [PASS] 11. Lead Workflow: Converted lead to Customer & Opportunity
  [PASS] 12. Opportunity Business Validation: Amount <= 0 rejected
  [PASS] 13. Opportunity Business Validation: Probability > 100 rejected
  [PASS] 14. Opportunity Business Validation: Past expected close date rejected
  [PASS] 15. Opportunity Management: Valid opportunity created
  [PASS] 16. Follow-Up Business Validation: Date earlier than today rejected
  [PASS] 17. Follow-Up Management: Valid follow-up scheduled
  [PASS] 18. Authorization: Sales Executive blocked from User Management (403 Forbidden)
  [PASS] 19. Authorization: Sales Executive blocked from Audit Logs (403 Forbidden)
  [PASS] 20. Dashboard: KPI metrics and Chart.js datasets loaded correctly
  [PASS] 21. Audit Logging: Audit trail contains tamper-proof operation logs
  [PASS] 22. Safe Authentication Logout
----------------------------------------
RESULTS: 22 PASSED, 0 FAILED
----------------------------------------
```

---

## REST API Reference

| Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Register new user | Public |
| `POST` | `/api/auth/login` | Authenticate & get token | Public |
| `POST` | `/api/auth/logout` | Terminate session & log audit | Authenticated |
| `GET` | `/api/auth/me` | Current authenticated user profile | Authenticated |
| `GET` | `/api/customers` | Search & list customers | Authenticated |
| `POST` | `/api/customers` | Create customer with validation | Authenticated |
| `GET` | `/api/customers/:id` | Customer 360 profile with linked records | Authenticated |
| `PUT` | `/api/customers/:id` | Update customer record | Authenticated |
| `DELETE` | `/api/customers/:id` | Delete / deactivate customer | Admin, Manager |
| `GET` | `/api/leads` | Search & filter leads | Authenticated |
| `POST` | `/api/leads` | Capture new lead | Authenticated |
| `POST` | `/api/leads/:id/convert`| Convert lead to Customer & Opportunity | Authenticated |
| `GET` | `/api/opportunities` | Search & list opportunities | Authenticated |
| `POST` | `/api/opportunities` | Create opportunity with validations | Authenticated |
| `GET` | `/api/followups` | Filter upcoming / overdue follow-ups | Authenticated |
| `POST` | `/api/followups` | Schedule new follow-up (today/future) | Authenticated |
| `GET` | `/api/activities` | Activity feed (calls, emails, meetings)| Authenticated |
| `POST` | `/api/activities` | Log new activity touchpoint | Authenticated |
| `GET` | `/api/users` | List application users | Admin Only |
| `POST` | `/api/users` | Provision user and assign role | Admin Only |
| `POST` | `/api/users/:id/unlock` | Unlock locked user account | Admin Only |
| `POST` | `/api/users/:id/reset-password` | Admin password reset | Admin Only |
| `GET` | `/api/audit-logs` | Query append-only audit stream | Admin Only |
| `GET` | `/api/reports/:reportType` | Pipeline, conversion & summary reports | Authenticated |
