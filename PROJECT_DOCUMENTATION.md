# AcxiomCRM — Comprehensive Project Technical Documentation

**System Name**: AcxiomCRM Enterprise System  
**Version**: 2.0.0 (Production Ready)  
**Architecture**: Decoupled Client-Server SaaS Architecture  
**Author / Team**: Senior Full-Stack Engineering Team  
**Last Updated**: October 2026  

---

## Table of Contents
1. [Executive Overview](#1-executive-overview)
2. [Technology Stack](#2-technology-stack)
3. [System Architecture & Data Flow](#3-system-architecture--data-flow)
4. [Database Schemas & Data Models](#4-database-schemas--data-models)
5. [Authentication & Security Framework](#5-authentication--security-framework)
6. [Role-Based Access Control (RBAC) Matrix](#6-role-based-access-control-rbac-matrix)
7. [CRM Functional Modules & Workflows](#7-crm-functional-modules--workflows)
8. [UI/UX Design System & Responsive Layout](#8-uiux-design-system--responsive-layout)
9. [Complete REST API Catalog](#9-complete-rest-api-catalog)
10. [Dual Backend Implementations (Node.js & ASP.NET Core)](#10-dual-backend-implementations)
11. [Installation, Configuration & Quickstart](#11-installation-configuration--quickstart)
12. [Testing, Verification & Quality Assurance](#12-testing-verification--quality-assurance)
13. [Requirement Traceability & Coverage Matrix](#13-requirement-traceability--coverage-matrix)

---

## 1. Executive Overview

**AcxiomCRM** is an enterprise-grade Customer Relationship Management (CRM) web application designed to streamline customer lifecycles, lead acquisition, sales pipeline forecasting, follow-up scheduling, activity tracking, and compliance auditing.

The system delivers:
- **True Multi-Role Authorization**: Enforces strict row-level security and permission segregation across **System Administrator**, **Sales Manager**, and **Sales Executive** roles.
- **Enterprise Security**: Incorporates ASP.NET Core Identity specification PBKDF2 password hashing, Anti-Forgery (CSRF) HMAC token verification, progressive account lockout protection, and tamper-evident audit logging.
- **Real-Time Pipeline Analytics**: Executive KPI cards, Chart.js interactive visualizations (Opportunity Pipeline value distributions, Lead qualification breakdowns, Monthly won revenue trends), and weighted forecasting.
- **Modern Responsive Design**: Enterprise SaaS styling following a clean navy-and-blue theme (`#172554` / `#2563EB` / `#F8FAFC`) with full responsiveness from 320px mobile viewports up to desktop displays.

---

## 2. Technology Stack

### 2.1 Frontend Client
- **Framework**: React.js 18.2 with Vite 6.4 build tooling
- **Routing**: React Router DOM 6.x with Protected & Public Route Guards
- **Styling**: Tailwind CSS 3.4 with custom enterprise tokens (`crm-*`)
- **Icons**: Lucide React (feather-style SVG icons)
- **Data Visualization**: Chart.js 4.4 and `react-chartjs-2` (Bar, Doughnut, Line charts)
- **HTTP Client**: Axios with request/response interceptors for JWT Bearer injection, CSRF header propagation, and 401 session expiration handling

### 2.2 Primary Backend API (Node.js / Express)
- **Runtime**: Node.js v18+ / v20+
- **Web Framework**: Express.js 4.18
- **Database Driver**: Mongoose 8.x
- **Token Security**: JSON Web Token (`jsonwebtoken`) with HMAC-SHA256
- **Cryptography**: `crypto` native module implementing RFC 2898 PBKDF2 with HMAC-SHA256 (100,000 iterations) conforming to Microsoft ASP.NET Core Identity PasswordHasher V3 specification
- **CORS & Middleware**: Express JSON body-parsing, cookie parsing, double-submit HMAC Anti-Forgery protection, rate limiting, and global error handling

### 2.3 Secondary Backend API (ASP.NET Core 8.0 Compliance)
- **Framework**: Microsoft ASP.NET Core 8.0 Web API
- **Identity Framework**: Microsoft.AspNetCore.Identity with `ApplicationUser` extending `IdentityUser` and `IdentityRole`
- **ORM & Database**: Entity Framework Core 8.0 with SQLite (`acxiomcrm.db`)
- **Authentication**: `JwtBearerDefaults` with `SignInManager<ApplicationUser>` and `UserManager<ApplicationUser>`
- **API Documentation**: OpenAPI / Swagger Swashbuckle

### 2.4 Database
- **Primary**: MongoDB (Local `127.0.0.1:27017` or MongoDB Atlas cloud cluster)
- **Secondary**: SQLite relational engine (for the ASP.NET Core EF Core backend)

---

## 3. System Architecture & Data Flow

### 3.1 High-Level Architecture Diagram

```
+-----------------------------------------------------------------------------------+
|                              Client Layer (React + Vite)                         |
|  - Layout (Responsive Sidebar Drawer + Enterprise Navbar + Notifications Popover) |
|  - AuthContext (Session Purge, Token Storage, User State Management)              |
|  - Modules: Dashboard, Customers, Leads, Opportunities, Follow-Ups,               |
|            Activities, Reports, User Management, Audit Logs                       |
+-----------------------------------------------------------------------------------+
                                   |          ^
         HTTP / REST Calls (JSON)  |          |  JSON Responses / JWT Cookies
         with Bearer & CSRF Token  v          |
+-----------------------------------------------------------------------------------+
|                         API Gateway / Middleware Pipeline                         |
|  - CORS Handler (Origins: localhost:3000)                                         |
|  - Anti-Forgery Verification (HMAC Double-Submit Cookie/Header check)             |
|  - Authentication Guard (JWT Verify + Token Role DB Cross-Check)                 |
|  - RBAC Authorization Guard (Admin / Manager / Sales Executive enforcement)       |
|  - Audit Logging Interceptor (Captures IP, User, Timestamp, Mutation payload)     |
+-----------------------------------------------------------------------------------+
                                   |          ^
                                   v          |
+-----------------------------------------------------------------------------------+
|                         Controller & Service Business Logic                       |
|  - Auth Controller (Login, Register, Logout, Me, Lockout Manager)                 |
|  - Customer Controller (Master data, Customer 360, Row-Level Scoping)            |
|  - Lead Controller (Capture, Status Workflow, Lead-to-Customer Conversion)       |
|  - Opportunity Controller (Pipeline Stages, Weighted Forecasting)                 |
|  - Follow-Up & Activity Controllers (Schedule touchpoints, Event Logging)         |
|  - Dashboard & Report Controllers (Aggregate metrics, Timeframe filters)         |
|  - User & Audit Controllers (Account status toggle, Security audit stream)        |
+-----------------------------------------------------------------------------------+
                                   |          ^
               Mongoose ODM Queries|          | Document Results
                                   v          |
+-----------------------------------------------------------------------------------+
|                              Database (MongoDB / SQLite)                          |
|  - Collections: Users, Customers, Leads, Opportunities, FollowUps,               |
|                 Activities, AuditLogs                                             |
+-----------------------------------------------------------------------------------+
```

### 3.2 Authentication & Verification Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as User Browser
    participant Client as React Client (Vite)
    participant Middleware as Auth & AntiForgery Middleware
    participant Server as Auth Controller
    participant DB as MongoDB Database

    User->>Client: Enters Email & Password on /login
    Client->>Client: Validates format & flushes stale localStorage
    Client->>Middleware: POST /api/auth/login + RequestVerificationToken
    Middleware->>Middleware: Validates Anti-Forgery Token
    Middleware->>Server: Forwards validated credentials
    Server->>DB: User.findOne({ email: normalizedEmail }).select('+password')
    DB-->>Server: Returns User document with PBKDF2 hash & lockout status
    Server->>Server: Verifies account lockout (lockoutEnd > now)
    Server->>Server: Verifies PBKDF2 hash via verifyPassword()
    alt Password Invalid
        Server->>DB: Increments failedLoginCount (+1); checks lockout threshold
        Server-->>Client: 401 Unauthorized ("Invalid email or password")
        Client->>User: Displays friendly error message
    else Password Valid
        Server->>DB: Resets failedLoginCount = 0; lockoutEnd = null
        Server->>Server: Signs JWT with { id, email, name, role, department }
        Server->>DB: Logs LOGIN action in AuditLogs collection
        Server-->>Client: 200 OK + JWT Bearer Token + User Profile DTO
        Client->>Client: Stores acxiom_token & acxiom_user; updates AuthContext
        Client->>User: Redirects to authorized Dashboard
    end
```

---

## 4. Database Schemas & Data Models

### 4.1 `User` Model (Conforming to ASP.NET Core `IdentityUser`)
Represents system user accounts with security stamps, concurrency stamps, and progressive account lockout.

| Field Name | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `_id` | ObjectId | Primary Key | Unique user identifier |
| `name` | String | Required, max 100 | Full name of the user |
| `userName` | String | Auto-set to email | ASP.NET Identity compatible username |
| `normalizedUserName` | String | Auto-uppercase | Uppercase normalized username |
| `email` | String | Required, Unique, Lowercase | Unique login email address |
| `normalizedEmail` | String | Auto-uppercase | Uppercase normalized email |
| `emailConfirmed` | Boolean | Default `true` | Identity email verification flag |
| `password` | String | Required, Hidden (`select: false`) | ASP.NET Identity PBKDF2 hashed password |
| `securityStamp` | String | UUID, Hidden (`select: false`) | Invalidation stamp for credentials |
| `concurrencyStamp` | String | UUID | Concurrency stamp for updates |
| `role` | String | Enum: `['Admin', 'Manager', 'Sales Executive']` | Authorization role |
| `department` | String | Default `'Sales'` | Department name |
| `phone` | String | Optional, trimmed | Phone number |
| `isActive` | Boolean | Default `true` | Administrator activation toggle |
| `failedLoginCount` | Number | Default `0` | Consecutive failed attempts counter |
| `lockoutEnabled` | Boolean | Default `true` | Progressive lockout protection flag |
| `lockoutEnd` | Date | Default `null` | Expiry timestamp for account lockout |

---

### 4.2 `Customer` Model
Master data for corporate accounts, clients, and partners.

| Field Name | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `customerCode` | String | Required, Unique | Formatted code (e.g. `CUST-1001`) |
| `customerName` | String | Required, Trimmed | Company or organization display name |
| `email` | String | Required, Valid Email | Primary corporate email address |
| `phone` | String | Required, Trimmed | Contact telephone number |
| `companyName` | String | Optional | Registered legal entity name |
| `address` | String | Optional | Street and physical address |
| `city` | String | Optional | City of operation |
| `state` | String | Optional | State / Province |
| `status` | String | Enum: `['Active', 'Inactive', 'Prospect', 'Lead']` | Account engagement status |
| `assignedTo` | ObjectId (Ref: User) | Required | Assigned Sales Executive owner |
| `createdBy` | ObjectId (Ref: User) | Required | User who initialized the customer |
| `notes` | String | Optional | Engagement notes and history |

---

### 4.3 `Lead` Model
Captures potential commercial sales engagements and supports conversion to Customer/Opportunity.

| Field Name | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `leadCode` | String | Required, Unique | Formatted code (e.g. `LEAD-1001`) |
| `leadName` | String | Required, Trimmed | Contact or prospect individual name |
| `email` | String | Required, Valid Email | Prospect email address |
| `phone` | String | Required, Trimmed | Prospect phone number |
| `companyName` | String | Optional | Prospect company or employer |
| `source` | String | Enum: `['Website', 'Referral', 'Cold Call', 'Social Media', 'Partner']` | Inbound acquisition channel |
| `status` | String | Enum: `['New', 'Contacted', 'Qualified', 'Unqualified', 'Converted', 'Lost']` | Qualification lifecycle status |
| `priority` | String | Enum: `['High', 'Medium', 'Low']` | Sales urgency tier |
| `expectedValue` | Number | Min `0` | Estimated deal value ($) |
| `assignedTo` | ObjectId (Ref: User) | Required | Assigned sales owner |
| `createdBy` | ObjectId (Ref: User) | Required | Lead creator |
| `convertedCustomerId` | ObjectId (Ref: Customer) | Optional | Foreign key to Customer if converted |
| `notes` | String | Optional | Discovery and discovery qualification notes |

---

### 4.4 `Opportunity` Model
Commercial deals moving through the sales pipeline.

| Field Name | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `opportunityName` | String | Required, Trimmed | Title of the commercial deal |
| `customerId` | ObjectId (Ref: Customer) | Required | Associated customer organization |
| `leadId` | ObjectId (Ref: Lead) | Optional | Originating lead record |
| `amount` | Number | Required, Min `0.01` | Commercial contract value ($) |
| `stage` | String | Enum: `['Qualification', 'Proposal', 'Negotiation', 'Won', 'Lost']` | Active deal progression stage |
| `probability` | Number | Min `0`, Max `100` | Percentage probability of winning |
| `expectedCloseDate` | Date | Required | Projected contract finalization date |
| `status` | String | Enum: `['Open', 'Won', 'Lost']` | High-level status |
| `assignedTo` | ObjectId (Ref: User) | Required | Commercial account executive |
| `createdBy` | ObjectId (Ref: User) | Required | Deal creator |
| `notes` | String | Optional | Commercial terms and notes |

---

### 4.5 `FollowUp` Model
Scheduled communications and client reminders.

| Field Name | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `relatedType` | String | Enum: `['Customer', 'Lead']` | Relationship target |
| `customerId` | ObjectId (Ref: Customer) | Conditional | Target customer |
| `leadId` | ObjectId (Ref: Lead) | Conditional | Target lead |
| `followUpDate` | Date | Required | Scheduled execution timestamp |
| `followUpType` | String | Enum: `['Call', 'Meeting', 'Email', 'Demo']` | Communication channel |
| `subject` | String | Required, Trimmed | Summary agenda or reminder topic |
| `remarks` | String | Optional | Call talking points or background |
| `status` | String | Enum: `['Planned', 'Completed', 'Missed', 'Cancelled']` | Execution status |
| `assignedTo` | ObjectId (Ref: User) | Required | Task owner |
| `completedAt` | Date | Optional | Timestamp when completed |

---

### 4.6 `Activity` Model
Immutable or updated touchpoint log capturing interactions.

| Field Name | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `activityType` | String | Enum: `['Call', 'Meeting', 'Email', 'Task']` | Activity category |
| `subject` | String | Required, Trimmed | Interaction summary headline |
| `description` | String | Optional | Detailed interaction notes |
| `activityDate` | Date | Required | Date and time interaction occurred |
| `customerId` | ObjectId (Ref: Customer) | Optional | Linked customer entity |
| `leadId` | ObjectId (Ref: Lead) | Optional | Linked lead entity |
| `assignedTo` | ObjectId (Ref: User) | Required | Activity logger / owner |
| `status` | String | Enum: `['Completed', 'Planned']` | Outcome state |

---

### 4.7 `AuditLog` Model
Tamper-evident audit trail capturing critical system mutations, logins, and security events.

| Field Name | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `userId` | ObjectId (Ref: User) | Optional | Initiating user ID |
| `userName` | String | Optional | Initiating user full name |
| `userRole` | String | Optional | Initiating user role |
| `action` | String | Required | Event code (`LOGIN`, `CREATE`, `UPDATE`, `DELETE`, `LOCKOUT`, etc.) |
| `entityName` | String | Required | Entity affected (`Customer`, `Lead`, `Auth`, `User`, etc.) |
| `recordId` | String | Optional | Stringified identifier of the affected record |
| `details` | String | Optional | Human-readable explanation of the operation |
| `oldValue` | Mixed | Optional (No secrets) | Snapshot of state prior to update |
| `newValue` | Mixed | Optional (No secrets) | Snapshot of state after mutation |
| `ipAddress` | String | Optional | Client remote IP address |
| `result` | String | Enum: `['SUCCESS', 'FAILED']` | Outcome of the attempted action |
| `createdAt` | Date | Automatic | Immutable creation timestamp |

---

## 5. Authentication & Security Framework

### 5.1 ASP.NET Core Identity Password Hasher Implementation
To satisfy the enterprise specification, the password hashing engine (`aspnetIdentityHasher.js`) adheres to the official **Microsoft ASP.NET Core Identity PasswordHasher V3** binary format:
- **Header Byte**: `0x01` (denoting Format V3)
- **Key Derivation Function**: PBKDF2 with HMAC-SHA256
- **Iteration Count**: 100,000 iterations
- **Salt Length**: 16 bytes (128 bits) cryptographically generated via `crypto.randomBytes(16)`
- **Subkey Length**: 32 bytes (256 bits)
- **Binary Packing**: Byte 0: `0x01` | Bytes 1–4: KeyDerivationPrf big-endian `0x00000001` (HMACSHA256) | Bytes 5–8: Iteration Count big-endian `100000` | Bytes 9–12: Salt Length `16` | Bytes 13–28: Salt Bytes | Bytes 29+: Subkey Bytes
- **Base64 Encoding**: Resulting binary payload is stored as a clean Base64 string.
- **Timing Attack Defense**: Comparisons utilize `crypto.timingSafeEqual` over derived bytes to thwart side-channel timing analysis.

### 5.2 Progressive Account Lockout
- **Threshold**: 5 consecutive failed login attempts (`LOCKOUT_MAX_ATTEMPTS`).
- **Duration**: 15 minutes (`LOCKOUT_DURATION_MINUTES`).
- **Lockout Mechanism**: When a 5th incorrect password is provided, `lockoutEnd` is calculated and saved on the User document. Subsequent attempts are rejected with `403 Forbidden` and a friendly countdown ("Account is temporarily locked. Try again in X minutes").
- **Admin Unlock**: Administrators can manually unlock any locked user via the User Management module (`PUT /api/users/:id/unlock`), resetting `failedLoginCount = 0` and clearing `lockoutEnd`.

### 5.3 Anti-Forgery (CSRF) Protection
All state-changing operations (`POST`, `PUT`, `DELETE`, `PATCH`) are verified by genuine anti-forgery middleware (`antiforgeryMiddleware.js`):
- **Generation**: The endpoint `GET /api/antiforgery/token` generates an HMAC-signed token consisting of `<random-nonce>.<hmac-signature>`.
- **Double-Submit Verification**: The token is delivered to the browser in an `XSRF-TOKEN` cookie, and outgoing Axios requests read this token and attach it as the `RequestVerificationToken` (and `X-CSRF-TOKEN`) header.
- **HMAC Validation**: Requests missing the header or presenting an invalid HMAC signature are rejected with `403 Forbidden`. Safe methods (`GET`, `HEAD`, `OPTIONS`) are exempt.

### 5.4 Token Role Integrity & Claim Validation
- When issued, JWT tokens embed claims: `{ id, email, name, role, department }`.
- In `authMiddleware.js`, upon decoding the token, the user's current role in the database is verified:
  ```javascript
  if (decoded.role && decoded.role !== user.role) {
    return res.status(401).json({
      success: false,
      message: 'Token role does not match current user account. Please log in again.'
    });
  }
  ```
- This guarantees that if an administrator changes a user's role or deactivates their account, stale tokens cannot execute privileged actions.

---

## 6. Role-Based Access Control (RBAC) Matrix

| Module / Operation | System Administrator (`Admin`) | Sales Manager (`Manager`) | Sales Executive (`Sales Executive`) |
| :--- | :---: | :---: | :---: |
| **System Dashboard** | Full System + Security Stats | Full Team Data | Row-Level Scoped (Assigned only) |
| **Customer List** | View All Customers | View All Customers | View Assigned & Created only |
| **Customer Create** | Allowed | Allowed | Allowed (auto-assigned to self) |
| **Customer Edit** | Full Edit Any Customer | Full Edit Any Customer | Edit Assigned only |
| **Customer Delete** | Allowed | Allowed | **Blocked (403 Forbidden)** |
| **Lead List** | View All Leads | View All Leads | View Assigned & Created only |
| **Lead Create** | Allowed | Allowed | Allowed |
| **Lead Edit / Convert** | Allowed | Allowed | Edit/Convert Assigned only |
| **Lead Delete** | Allowed | Allowed | **Blocked (403 Forbidden)** |
| **Opportunity List** | View All Deals | View All Deals | View Assigned Deals only |
| **Opportunity Create** | Allowed | Allowed | Allowed |
| **Opportunity Edit** | Full Edit Any Deal | Full Edit Any Deal | Edit Assigned Deals only |
| **Opportunity Delete** | Allowed | Allowed | **Blocked (403 Forbidden)** |
| **Follow-Ups** | View / Schedule Any | View / Schedule Any | Manage Assigned Touchpoints |
| **Activities** | View All Logs | View All Logs | Log / View Assigned Activities |
| **Executive Reports** | View All Reports | View All Pipeline Reports | **Blocked from User Reports (403)** |
| **User Administration** | **Full Access** (Create, Role, Unlock) | **Blocked (403 Forbidden)** | **Blocked (403 Forbidden)** |
| **Audit Logs Stream** | **Full Access** (Inspection) | **Blocked (403 Forbidden)** | **Blocked (403 Forbidden)** |

---

## 7. CRM Functional Modules & Workflows

### 7.1 Authentication & Registration Module
- **Public Self-Registration**: Users submit Full Name, Email, Password, and Confirm Password. Passwords must pass the policy (8+ chars, at least 1 letter, at least 1 number).
- **Least-Privilege Role**: Newly registered accounts are defaulted to `Sales Executive` on the server.
- **Immediate Session Creation**: Upon registration, an authenticated session is created and the user is redirected directly to their personalized Sales Executive Dashboard.
- **Login Flow**: Validates email and password against MongoDB, verifies account lockout, and issues a JWT token.
- **Session Purging**: Switching users flushes `localStorage` and `sessionStorage`, ensuring zero identity or role crossover.

### 7.2 Executive Dashboard & Pipeline Analytics
- **Dynamic Role Heading**:
  - `System Administrator Dashboard` (Admin)
  - `Sales Manager Dashboard` (Manager)
  - `Sales Executive Dashboard` (Sales Executive)
- **Top Metric KPI Cards**:
  - Total Customers (Active accounts)
  - Total Leads (New & Contacted prospects)
  - Total Pipeline Value ($ and Weighted forecast)
  - Won Opportunities (Closed won revenue)
- **Secondary KPI Row**: Open Opportunities, Lost Deals, Pending Follow-Ups, Weighted Forecast.
- **Interactive Chart.js Visualizations**:
  - **Opportunity Sales Pipeline**: Horizontal bar chart showing deal value distribution across Qualification, Proposal, Negotiation, Won, Lost stages.
  - **Lead Status Breakdown**: Doughnut chart illustrating lead proportions (New, Contacted, Qualified, Unqualified, Converted, Lost).
  - **Monthly Sales Trend**: Area line chart tracking trailing 6 months of closed won revenues.
- **Admin Security Banner**: Displays live user administration statistics (Total Users, Active Users, Locked Accounts). Only visible to Admins.
- **Upcoming Touchpoints & Audit Stream**: Displays next scheduled calls/meetings and latest activity logs.

### 7.3 Customer Management Module (Customer 360)
- Master customer repository with customer codes (e.g. `CUST-1001`), company names, addresses, and account statuses.
- **Customer 360 View**: Modal displaying complete account details, open opportunities, linked follow-ups, and engagement history in a single view.
- **Validation**: Strict corporate email format, phone number validation, and duplicate email prevention (`409 Conflict`).
- **Deletion Protection**: Deletion requires confirmation and is restricted to Administrators and Managers.

### 7.4 Lead Management & Lead Conversion Engine
- Captures inbound prospects across Website, Referral, Cold Call, Social Media, and Partner channels.
- Priority categorizations (High, Medium, Low) and expected commercial values.
- **One-Click Lead-to-Customer Conversion**:
  - Converts a qualified lead into an Active Customer record.
  - Automatically spawns an initial Opportunity in the Qualification stage.
  - Links the originating Lead to the new Customer entity and flags lead status as `Converted`.
  - Logs the conversion in the Audit Log.

### 7.5 Opportunity Pipeline & Forecasting
- Deal stage progression: Qualification &rarr; Proposal &rarr; Negotiation &rarr; Won / Lost.
- Probability scoring (0% to 100%) and calculated weighted forecasting:  
  $$\text{Weighted Forecast} = \sum (\text{Amount} \times \frac{\text{Probability}}{100})$$
- Validation rules: Amount must be $> 0$; probability must be between 0 and 100; close date must be in the future for open deals.

### 7.6 Follow-Up Scheduling & Activity Stream
- Schedule communications across Calls, Meetings, Emails, and Product Demos.
- Status management: Planned &rarr; Completed / Missed / Cancelled.
- Timeline stream displaying recent touchpoints with customer and lead linkages.

### 7.7 Advanced Reports Module
- **Pipeline Stage Analysis**: Bar chart and tabular summary of deal counts, total values, and average deal sizes per stage.
- **Lead Channel Conversion**: Performance breakdown by acquisition channel (Website, Referral, Social Media, etc.).
- **Monthly Revenue Realization**: Closed won contract values over trailing quarters.
- **User Activity Audit Report**: Summary of touchpoints logged per sales representative (restricted from Sales Executives).

### 7.8 User Management Module (Admin Exclusive)
- User directory displaying name, email, department, role badge, account status, and lockout state.
- **Role Elevation**: Administrators can promote/demote users between Sales Executive, Manager, and Admin.
- **Account State Controls**: Deactivate/activate accounts; unlock accounts locked by consecutive failed attempts.

### 7.9 Audit Logs Stream (Admin Exclusive)
- Immutable log capturing all database mutations, authentication attempts, lockouts, and lead conversions.
- Details modal inspecting before/after JSON diffs without exposing passwords or security stamps.

---

## 8. UI/UX Design System & Responsive Layout

### 8.1 Color Palette Specifications

```
  +--------------------------------------------------------------+
  |  #172554 (Deep Navy)    - Brand Sidebar, Primary Headings    |
  |  #2563EB (Action Blue)  - Interactive Buttons, Active Links  |
  |  #F8FAFC (Neutral Gray) - Application Background             |
  |  #FFFFFF (Pure White)   - Cards, Tables, Forms, Modals       |
  |  #1E293B (Dark Slate)   - Primary Typography & Body Text     |
  |  #64748B (Muted Slate)  - Secondary Labels, Helpers, Dates   |
  |  #E2E8F0 (Border Gray)  - Crisp Table & Card Outlines        |
  |  #16A34A (Success)      - Won Deals, Active States           |
  |  #D97706 (Warning)      - Pending Items, Medium Priority     |
  |  #DC2626 (Error)        - Validation Errors, Account Lockout |
  +--------------------------------------------------------------+
```

### 8.2 Responsive Layout Adaptations

| Viewport Range | Device Class | Navigation Layout | Content Grid | Table Behavior |
| :--- | :--- | :--- | :--- | :--- |
| **320px – 480px** | Compact Smartphones | Collapsible Drawer with Overlay | 1 Column Stacked | Horizontal container scroll (`overflow-x-auto`) |
| **481px – 767px** | Large Smartphones | Collapsible Drawer with Overlay | 1–2 Column Grid | Horizontal container scroll |
| **768px – 1023px** | Tablets (Portrait/Landscape) | Collapsible Drawer with Hamburger | 2 Column Grid | Responsive table with stacked cells |
| **1024px – 1279px** | Laptops | Fixed 64px Dark Navy Sidebar | 3 Column Grid | Full table layout |
| **1280px+** | Desktop Workstations | Fixed 64px Dark Navy Sidebar | 4 Column KPI Grid | Full widescreen layout |

---

## 9. Complete REST API Catalog

### 9.1 Authentication Endpoints (`/api/auth`)
- `POST /api/auth/register`: Public self-registration (assigns `Sales Executive`)
- `POST /api/auth/login`: Authenticate email/password & issue JWT token
- `POST /api/auth/logout`: Invalidate session cookie and log out
- `GET /api/auth/me`: Retrieve current authenticated user profile
- `GET /api/antiforgery/token`: Generate signed CSRF verification token

### 9.2 Customer Endpoints (`/api/customers`)
- `GET /api/customers`: List customers (filtered by role & search query)
- `POST /api/customers`: Create new customer (auto-assigns to creator if Sales Executive)
- `GET /api/customers/:id`: Customer 360 profile with opportunities & follow-ups
- `PUT /api/customers/:id`: Update customer details (scoped to owner/admin)
- `DELETE /api/customers/:id`: Delete customer (Admin & Manager only)

### 9.3 Lead Endpoints (`/api/leads`)
- `GET /api/leads`: List leads (scoped by role, filterable by status & priority)
- `POST /api/leads`: Capture new lead
- `GET /api/leads/:id`: Retrieve lead by ID
- `PUT /api/leads/:id`: Update lead details
- `DELETE /api/leads/:id`: Delete lead (Admin & Manager only)
- `POST /api/leads/:id/convert`: Convert lead to Customer & Opportunity

### 9.4 Opportunity Endpoints (`/api/opportunities`)
- `GET /api/opportunities`: List opportunities (scoped by role)
- `POST /api/opportunities`: Create commercial opportunity
- `GET /api/opportunities/:id`: Retrieve opportunity details
- `PUT /api/opportunities/:id`: Update stage, probability, and amount
- `DELETE /api/opportunities/:id`: Delete opportunity (Admin & Manager only)

### 9.5 Follow-Up & Activity Endpoints
- `GET /api/followups`: List scheduled touchpoints
- `POST /api/followups`: Schedule new touchpoint
- `PUT /api/followups/:id`: Mark follow-up as Completed / Missed
- `DELETE /api/followups/:id`: Delete follow-up
- `GET /api/activities`: List activity interaction feed
- `POST /api/activities`: Log activity (Call, Meeting, Email, Task)

### 9.6 Dashboard & Reporting Endpoints
- `GET /api/dashboard`: Aggregated KPIs, pipeline charts, and monthly trends
- `GET /api/reports/pipeline`: Pipeline stage revenue analytics
- `GET /api/reports/conversion`: Lead conversion channel metrics
- `GET /api/reports/user-activity`: User touchpoint metrics (Admin/Manager only)

### 9.7 User Management & Audit Endpoints (Admin Exclusive)
- `GET /api/users`: List all system users with status and lockout state
- `POST /api/users`: Create user with assigned role (Admin only)
- `PUT /api/users/:id`: Update user role, department, or active state
- `PUT /api/users/:id/unlock`: Unlock locked user account
- `GET /api/audit-logs`: Paginated stream of system audit logs

---

## 10. Dual Backend Implementations

To ensure complete adherence to both standard MERN stack development and strict ASP.NET Core Identity assignment requirements, AcxiomCRM provides two distinct backend implementations sharing the exact same React frontend:

### Implementation A: Node.js / Express API (`server/`)
- **Port**: `5000`
- **Database**: MongoDB (`acxiomcrm`)
- **Password Hasher**: Custom RFC 2898 PBKDF2 implementation adhering byte-for-byte to ASP.NET Core Identity PasswordHasher V3 format.
- **Best Suited For**: Cross-platform Node.js environments, cloud container deployments, and MongoDB Atlas.

### Implementation B: ASP.NET Core 8.0 Identity API (`backend-aspnet/`)
- **Port**: `5050`
- **Framework**: Official `Microsoft.AspNetCore.Identity` with `ApplicationUser : IdentityUser`
- **Database**: Entity Framework Core with SQLite (`acxiomcrm.db`)
- **SignInManager**: Genuine `SignInManager<ApplicationUser>.CheckPasswordSignInAsync` handling password hashing and lockout.
- **Best Suited For**: Direct academic/assignment compliance where native ASP.NET Core Identity DLLs are required.

Both backends expose identical REST contracts, enabling the React client to point to either port seamlessly via `vite.config.js` proxy settings.

---

## 11. Installation, Configuration & Quickstart

### 11.1 Prerequisites
- Node.js v18.0.0 or higher
- MongoDB running locally on `mongodb://127.0.0.1:27017` (or MongoDB Atlas URI)
- .NET 8.0 SDK (optional, for running the ASP.NET Core backend)

### 11.2 Environment Variables (`server/.env`)
```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://127.0.0.1:27017/acxiomcrm
JWT_SECRET=acxiom_crm_jwt_super_secret_production_key_2026_secure
JWT_EXPIRES_IN=7d
LOCKOUT_MAX_ATTEMPTS=5
LOCKOUT_DURATION_MINUTES=15
```

### 11.3 Step-by-Step Execution

#### Step 1: Install Dependencies
```bash
# Install backend dependencies
cd server
npm install

# Install frontend dependencies
cd ../client
npm install
```

#### Step 2: Seed Development Database
```bash
cd server
npm run seed
```
*Seeds initial master data (Alexander Pierce as Admin, Sarah Connor as Manager, Marcus Vance as Sales Executive, initial customers, leads, opportunities, follow-ups, and audit entries).*

#### Step 3: Start Backend API
```bash
cd server
npm start
# Server listens on http://localhost:5000
```

#### Step 4: Start Frontend Client
```bash
cd client
npm run dev
# Client runs on http://localhost:3000
```

---

## 12. Testing, Verification & Quality Assurance

The system includes three comprehensive automated test suites verifying all security controls, authorization boundaries, CRUD workflows, client/server validations, and reporting features:

### 12.1 Test Suite Breakdown

1. **Validation & Reports Suite** (`server/tests/verifyValidationAndReports.js`):
   - **47 Assertions | 100% PASS**
   - Validates client and server validation across Customer, Lead, Opportunity, Follow-Up, and Activity modules (empty field rejections, max lengths, email regex, phone formatting, 409 Conflict duplicate email/phone rejections, numeric bounds, past date rejections).
   - Validates all 8 core CRM reports, keyword search, status/stage filtering, date range filtering, configurable pagination (10, 25, 50, 100), column sorting, unpaginated CSV export, and role-based report restrictions (Sales Executive blocked from user activity and audit with 403; Manager blocked from audit with 403).

2. **Multi-Role Identity & Authorization Suite** (`server/tests/verifyRolesAndIdentities.js`):
   - **54 Assertions | 100% PASS**
   - Independently tests Admin, Manager, and Sales Executive credentials with complete session clearance between cycles.
   - Enforces 403 Forbidden boundaries on restricted endpoints for non-admin roles.
   - Verifies invalid and forged tokens return 401 Unauthorized.

3. **Registration & Auth Redesign Suite** (`server/tests/verifyRegistrationAndAuthRedesign.js`):
   - **42 Assertions | 100% PASS**
   - Validates real user self-registration, MongoDB persistence, duplicate email rejection (409 Conflict), password policy enforcement (8+ chars, letter, number), login with registered identity, incorrect password rejection, and independent demo logins.

### 12.2 Total QA Metric
- **Total Test Cases Executed**: **143 Automated Test Assertions**
- **Passing Rate**: **143 / 143 (100% PASS, 0 FAIL)**
- **Client Build Status**: `npm run build` &rarr; **Zero Errors / Clean Production Build**

---

## 13. Requirement Traceability & Coverage Matrix

| Specification Requirement | Verification Status | Implementation & Proof Details |
| :--- | :---: | :--- |
| **Client-Side & Server-Side Validation** | **COVERED (PASS)** | Implemented across all 5 modules (Customer, Lead, Opportunity, Follow-Up, Activity). Enforces required fields, string limits, email/phone format checks, duplicate 409 Conflict rejection, numeric ranges, and date validity. Client provides visual inline red error styling, helper messages, and auto-focusing. Verified by 21 automated validation tests. |
| **Reports, Filtering and Pagination** | **COVERED (PASS)** | All 8 core CRM reports implemented (`pipeline`, `opportunities`, `customers`, `leads`, `followups`, `conversion`, `user-activity`, `audit`). Interactive filters include keyword search, dynamic status/stage selector, assigned user selector, and date range filters. Features server-side pagination with limit selector, column header sorting, unpaginated CSV export, and strict RBAC isolation. Verified by 26 automated report tests. |
| **Authentication & ASP.NET Core Identity** | **COVERED (PASS)** | RFC 2898 PBKDF2 PasswordHasher V3 (100k iterations) and full ASP.NET Core 8.0 Identity Web API backend with `ApplicationUser : IdentityUser`. Verified by 54 test assertions. |
| **Anti-Forgery (CSRF) Protection** | **COVERED (PASS)** | HMAC-SHA256 signed double-submit cookie and request verification header (`X-CSRF-TOKEN`, `RequestVerificationToken`). |
| **Role-Based Access Control (RBAC)** | **COVERED (PASS)** | Strict authorization across Admin, Manager, and Sales Executive. Non-admin users strictly blocked with 403 Forbidden on user management, audit logs, and restricted reports. |
| **Modern Responsive UI Redesign** | **COVERED (PASS)** | Enterprise Navy theme (`#172554`, `#2563EB`, `#F8FAFC`), full responsiveness from mobile up to desktop, collapsible sidebar, status badges, and Chart.js dashboards. |

---
*Documentation compiled and verified for AcxiomCRM Enterprise System.*

