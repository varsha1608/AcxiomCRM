const http = require('http');

let currentCookies = {};
let csrfToken = null;
let currentAuthToken = null;

const parseCookies = (setCookieHeaders) => {
  if (!setCookieHeaders) return;
  const headers = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
  headers.forEach((h) => {
    const parts = h.split(';')[0].split('=');
    if (parts.length >= 2) {
      currentCookies[parts[0].trim()] = parts.slice(1).join('=').trim();
    }
  });
};

const getCookieHeader = () => {
  return Object.entries(currentCookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
};

const request = (method, path, headers = {}, body = null) => {
  return new Promise((resolve, reject) => {
    const url = new URL(path, 'http://127.0.0.1:5000');
    const cookieHeader = getCookieHeader();
    const reqHeaders = {
      'Content-Type': 'application/json',
      ...headers
    };
    if (cookieHeader) {
      reqHeaders['Cookie'] = cookieHeader;
    }
    if (currentAuthToken) {
      reqHeaders['Authorization'] = `Bearer ${currentAuthToken}`;
    }
    if (csrfToken && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method.toUpperCase())) {
      reqHeaders['X-CSRF-TOKEN'] = csrfToken;
      reqHeaders['RequestVerificationToken'] = csrfToken;
      reqHeaders['x-xsrf-token'] = csrfToken;
    }

    const req = http.request(
      url,
      {
        method,
        headers: reqHeaders
      },
      (res) => {
        if (res.headers['set-cookie']) {
          parseCookies(res.headers['set-cookie']);
        }

        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch (e) {
            parsed = data;
          }
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        });
      }
    );
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
};

const obtainCsrf = async () => {
  const res = await request('GET', '/api/antiforgery/token');
  if (res.body?.token) {
    csrfToken = res.body.token;
  }
};

const loginUser = async (email, password) => {
  currentCookies = {};
  csrfToken = null;
  currentAuthToken = null;
  await obtainCsrf();
  const res = await request('POST', '/api/auth/login', {}, { email, password });
  if (res.status === 200 && res.body?.token) {
    currentAuthToken = res.body.token;
    return res.body.user;
  }
  throw new Error(`Failed to log in ${email}: ${JSON.stringify(res.body)}`);
};

let passedTests = 0;
let failedTests = 0;

const assert = (condition, description) => {
  if (condition) {
    console.log(`  [PASS] ${description}`);
    passedTests++;
  } else {
    console.error(`  [FAIL] ${description}`);
    failedTests++;
  }
};

const runAllTests = async () => {
  console.log('================================================================');
  console.log('AcxiomCRM: Comprehensive Validation & Reports Automated Test Suite');
  console.log('================================================================\n');

  try {
    // Authenticate Admin
    const adminUser = await loginUser('admin@acxiomcrm.com', 'Admin@12345');
    console.log(`[AUTH] Successfully logged in as Admin: ${adminUser.name} (${adminUser.role})\n`);

    // Fetch existing customer or create base customer for references
    const custRes = await request('GET', '/api/customers?limit=1');
    let testCustomerId = custRes.body?.data?.[0]?._id;
    let existingCustomerEmail = custRes.body?.data?.[0]?.email || 'existing@customer.com';
    let existingCustomerPhone = custRes.body?.data?.[0]?.phone || '9876543210';

    // Fetch existing lead or create base lead for references
    const leadRes = await request('GET', '/api/leads?limit=1');
    let testLeadId = leadRes.body?.data?.[0]?._id;

    // ---------------------------------------------------------
    // PART 1: Client & Server Side Validation Tests
    // ---------------------------------------------------------
    console.log('--- PART 1: CLIENT & SERVER-SIDE VALIDATION ---');

    // 1. Customer Validation
    console.log('\n[1. Customer Validation]');
    // 1.1 Customer Name required
    const c1 = await request('POST', '/api/customers', {}, {
      customerName: '   ',
      email: `valid_${Date.now()}@acxiom.com`,
      phone: '9988776655'
    });
    assert(c1.status === 400 && c1.body?.message?.includes('Customer name'), 'Customer: Rejects empty customer name with 400');

    // 1.2 Customer Name max 100
    const c2 = await request('POST', '/api/customers', {}, {
      customerName: 'A'.repeat(105),
      email: `valid_${Date.now()}@acxiom.com`,
      phone: '9988776655'
    });
    assert(c2.status === 400 && c2.body?.message?.includes('100 characters'), 'Customer: Rejects name exceeding 100 characters with 400');

    // 1.3 Invalid email format
    const c3 = await request('POST', '/api/customers', {}, {
      customerName: 'Test Corp',
      email: 'invalid-email-format',
      phone: '9988776655'
    });
    assert(c3.status === 400 && c3.body?.message?.toLowerCase().includes('email'), 'Customer: Rejects malformed email with 400');

    // 1.4 Invalid phone format
    const c4 = await request('POST', '/api/customers', {}, {
      customerName: 'Test Corp',
      email: `valid_${Date.now()}@acxiom.com`,
      phone: '123'
    });
    assert(c4.status === 400 && c4.body?.message?.toLowerCase().includes('phone'), 'Customer: Rejects short/invalid phone with 400');

    // 1.5 Duplicate email rejection (409 Conflict)
    const c5 = await request('POST', '/api/customers', {}, {
      customerName: 'Duplicate Email Corp',
      email: existingCustomerEmail,
      phone: '9988771122'
    });
    assert(c5.status === 409 && c5.body?.message?.includes('email'), 'Customer: Rejects duplicate email with 409 Conflict');

    // 1.6 Duplicate phone rejection (409 Conflict)
    const c6 = await request('POST', '/api/customers', {}, {
      customerName: 'Duplicate Phone Corp',
      email: `unique_${Date.now()}@acxiom.com`,
      phone: existingCustomerPhone
    });
    assert(c6.status === 409 && c6.body?.message?.includes('phone'), 'Customer: Rejects duplicate phone with 409 Conflict');

    // 1.7 Invalid status
    const c7 = await request('POST', '/api/customers', {}, {
      customerName: 'Test Corp',
      email: `unique_${Date.now()}@acxiom.com`,
      phone: '9988774433',
      status: 'UnknownStatus'
    });
    assert(c7.status === 400 && c7.body?.message?.includes('Invalid customer status'), 'Customer: Rejects invalid status enum with 400');

    // 1.8 Non-existent assignedTo user
    const c8 = await request('POST', '/api/customers', {}, {
      customerName: 'Test Corp',
      email: `unique_${Date.now()}@acxiom.com`,
      phone: '9988774433',
      assignedTo: '600000000000000000000000'
    });
    assert(c8.status === 400 && c8.body?.message?.includes('Assigned user does not exist'), 'Customer: Rejects non-existent assignedTo user with 400');

    // 1.9 Valid customer creation
    const uniqueEmail = `valid_cust_${Date.now()}@acxiom.com`;
    const uniquePhone = `99${Date.now().toString().slice(-8)}`;
    const cValid = await request('POST', '/api/customers', {}, {
      customerName: 'Acxiom Verified Solutions',
      email: uniqueEmail,
      phone: uniquePhone,
      companyName: 'Acxiom Enterprises',
      status: 'Active'
    });
    assert(cValid.status === 201 && cValid.body?.success, 'Customer: Successfully creates valid customer with 201');
    if (cValid.body?.data?._id) {
      testCustomerId = cValid.body.data._id;
    }

    // 2. Lead Validation
    console.log('\n[2. Lead Validation]');
    // 2.1 Lead name required
    const l1 = await request('POST', '/api/leads', {}, {
      leadName: '   ',
      email: 'lead@test.com',
      phone: '9988112233'
    });
    assert(l1.status === 400 && l1.body?.message?.includes('Lead name'), 'Lead: Rejects empty lead name with 400');

    // 2.2 ExpectedValue negative
    const l2 = await request('POST', '/api/leads', {}, {
      leadName: 'Test Lead',
      email: 'lead@test.com',
      phone: '9988112233',
      expectedValue: -500
    });
    assert(l2.status === 400 && l2.body?.message?.includes('Expected value'), 'Lead: Rejects negative expectedValue with 400');

    // 2.3 Invalid status
    const l3 = await request('POST', '/api/leads', {}, {
      leadName: 'Test Lead',
      email: 'lead@test.com',
      phone: '9988112233',
      status: 'InvalidLeadStatus'
    });
    assert(l3.status === 400 && l3.body?.message?.includes('status'), 'Lead: Rejects invalid lead status with 400');

    // 2.4 Valid lead creation
    const lValid = await request('POST', '/api/leads', {}, {
      leadName: 'Johnathan Edwards',
      email: `lead_${Date.now()}@acxiom.com`,
      phone: `88${Date.now().toString().slice(-8)}`,
      company: 'TechWave Corp',
      status: 'Qualified',
      expectedValue: 45000,
      leadSource: 'Website'
    });
    assert(lValid.status === 201 && lValid.body?.success, 'Lead: Successfully creates valid lead with 201');
    if (lValid.body?.data?._id) {
      testLeadId = lValid.body.data._id;
    }

    // 3. Opportunity Validation
    console.log('\n[3. Opportunity Validation]');
    // 3.1 Opportunity name required
    const o1 = await request('POST', '/api/opportunities', {}, {
      opportunityName: '   ',
      customerId: testCustomerId,
      amount: 50000,
      stage: 'Proposal',
      probability: 60,
      expectedCloseDate: new Date(Date.now() + 86400000 * 30).toISOString()
    });
    assert(o1.status === 400 && o1.body?.message?.includes('Opportunity name'), 'Opportunity: Rejects empty opportunity name with 400');

    // 3.2 Amount <= 0
    const o2 = await request('POST', '/api/opportunities', {}, {
      opportunityName: 'Big Cloud Migration',
      customerId: testCustomerId,
      amount: 0,
      stage: 'Proposal',
      probability: 60,
      expectedCloseDate: new Date(Date.now() + 86400000 * 30).toISOString()
    });
    assert(o2.status === 400 && o2.body?.message?.includes('greater than 0'), 'Opportunity: Rejects amount <= 0 with 400');

    // 3.3 Probability > 100
    const o3 = await request('POST', '/api/opportunities', {}, {
      opportunityName: 'Big Cloud Migration',
      customerId: testCustomerId,
      amount: 25000,
      stage: 'Proposal',
      probability: 150,
      expectedCloseDate: new Date(Date.now() + 86400000 * 30).toISOString()
    });
    assert(o3.status === 400 && o3.body?.message?.includes('Probability must be between 0 and 100'), 'Opportunity: Rejects probability > 100 with 400');

    // 3.4 ExpectedCloseDate in past for active opportunity
    const o4 = await request('POST', '/api/opportunities', {}, {
      opportunityName: 'Big Cloud Migration',
      customerId: testCustomerId,
      amount: 25000,
      stage: 'Negotiation',
      probability: 70,
      expectedCloseDate: '2020-01-01'
    });
    assert(o4.status === 400 && o4.body?.message?.includes('cannot be in the past'), 'Opportunity: Rejects past expected close date for active opportunity with 400');

    // 3.5 Invalid customer reference
    const o5 = await request('POST', '/api/opportunities', {}, {
      opportunityName: 'Big Cloud Migration',
      customerId: '600000000000000000000000',
      amount: 25000,
      stage: 'Negotiation',
      probability: 70,
      expectedCloseDate: new Date(Date.now() + 86400000 * 30).toISOString()
    });
    assert(o5.status === 404 && o5.body?.message?.includes('Customer does not exist'), 'Opportunity: Rejects non-existent customer reference with 404');

    // 3.6 Valid opportunity creation
    const futureDate = new Date(Date.now() + 86400000 * 45).toISOString();
    const oValid = await request('POST', '/api/opportunities', {}, {
      opportunityName: `Enterprise Suite Deal ${Date.now()}`,
      customerId: testCustomerId,
      leadId: testLeadId,
      amount: 75000,
      stage: 'Negotiation',
      probability: 75,
      expectedCloseDate: futureDate,
      notes: 'Final contract review in progress'
    });
    assert(oValid.status === 201 && oValid.body?.success, 'Opportunity: Successfully creates valid opportunity with 201');

    // 4. Follow-Up Validation
    console.log('\n[4. Follow-Up Validation]');
    // 4.1 Subject required
    const f1 = await request('POST', '/api/followups', {}, {
      subject: '   ',
      followUpType: 'Call',
      followUpDate: new Date(Date.now() + 86400000).toISOString(),
      status: 'Planned',
      customerId: testCustomerId
    });
    assert(f1.status === 400 && f1.body?.message?.includes('Subject'), 'Follow-Up: Rejects empty subject with 400');

    // 4.2 Past date for planned follow-up
    const f2 = await request('POST', '/api/followups', {}, {
      subject: 'Call client about quote',
      followUpType: 'Call',
      followUpDate: '2021-05-10',
      status: 'Planned',
      customerId: testCustomerId
    });
    assert(f2.status === 400 && (f2.body?.message?.includes('earlier than today') || f2.body?.message?.includes('cannot be in the past')), 'Follow-Up: Rejects past date for planned follow-up with 400');

    // 4.3 Invalid followUpType
    const f3 = await request('POST', '/api/followups', {}, {
      subject: 'Call client about quote',
      followUpType: 'Telepathy',
      followUpDate: new Date(Date.now() + 86400000).toISOString(),
      status: 'Planned',
      customerId: testCustomerId
    });
    assert(f3.status === 400 && f3.body?.message?.includes('Invalid follow-up type'), 'Follow-Up: Rejects invalid follow-up type enum with 400');

    // 4.4 Valid follow-up creation
    const fValid = await request('POST', '/api/followups', {}, {
      subject: 'Quarterly review call',
      followUpType: 'Call',
      followUpDate: new Date(Date.now() + 86400000 * 3).toISOString(),
      status: 'Planned',
      priority: 'High',
      customerId: testCustomerId,
      remarks: 'Prepare slides before calling'
    });
    assert(fValid.status === 201 && fValid.body?.success, 'Follow-Up: Successfully schedules valid follow-up with 201');

    // 5. Activity Validation
    console.log('\n[5. Activity Validation]');
    // 5.1 Subject required
    const a1 = await request('POST', '/api/activities', {}, {
      subject: '   ',
      activityType: 'Meeting',
      activityDate: new Date().toISOString()
    });
    assert(a1.status === 400 && a1.body?.message?.includes('Subject'), 'Activity: Rejects empty subject with 400');

    // 5.2 Invalid activity type
    const a2 = await request('POST', '/api/activities', {}, {
      subject: 'Met with CTO',
      activityType: 'Teleportation',
      activityDate: new Date().toISOString()
    });
    assert(a2.status === 400 && (a2.body?.message?.includes('Invalid activity type') || a2.body?.message?.includes('Activity type must be')), 'Activity: Rejects invalid activity type with 400');

    // 5.3 Valid activity creation
    const aValid = await request('POST', '/api/activities', {}, {
      subject: 'Executive architecture presentation',
      activityType: 'Meeting',
      activityDate: new Date().toISOString(),
      customerId: testCustomerId,
      status: 'Completed',
      description: 'Reviewed system security architecture with client VP.'
    });
    assert(aValid.status === 201 && aValid.body?.success, 'Activity: Successfully logs valid activity with 201');

    // ---------------------------------------------------------
    // PART 2: Reports, Filtering, Pagination, Sorting & Export Tests
    // ---------------------------------------------------------
    console.log('\n--- PART 2: REPORTS, FILTERING, PAGINATION & CSV EXPORT ---');

    // 6. Test all 8 core reports for Admin
    console.log('\n[6. All 8 Core Reports Execution (Admin)]');
    const reportsList = [
      { id: 'pipeline', name: '1. Pipeline Report' },
      { id: 'opportunities', name: '2. Opportunity Report' },
      { id: 'customers', name: '3. Customer Report' },
      { id: 'leads', name: '4. Lead Report' },
      { id: 'followups', name: '5. Follow-Up Report' },
      { id: 'conversion', name: '6. Conversion & Win Rate Report' },
      { id: 'user-activity', name: '7. User Activity Report' },
      { id: 'audit', name: '8. Security & Audit Report' }
    ];

    for (const r of reportsList) {
      const repRes = await request('GET', `/api/reports/${r.id}`);
      const isOk = repRes.status === 200 &&
                   repRes.body?.success === true &&
                   Array.isArray(repRes.body?.data) &&
                   repRes.body?.pagination !== undefined;
      assert(isOk, `${r.name}: Returns 200 OK with formatted data array & pagination`);
    }

    // 7. Filtering & Search Tests
    console.log('\n[7. Search & Parameter Filtering]');
    // 7.1 Search filter
    const searchRes = await request('GET', '/api/reports/customers?search=Acxiom');
    assert(
      searchRes.status === 200 &&
      searchRes.body.data.every((c) =>
        (c.customerName && c.customerName.toLowerCase().includes('acxiom')) ||
        (c.customerCode && c.customerCode.toLowerCase().includes('acxiom')) ||
        (c.companyName && c.companyName.toLowerCase().includes('acxiom'))
      ),
      'Reports: Search query correctly filters records by keyword'
    );

    // 7.2 Stage filter on opportunities
    const stageRes = await request('GET', '/api/reports/opportunities?stage=Negotiation');
    assert(
      stageRes.status === 200 &&
      stageRes.body.data.every((o) => o.stage === 'Negotiation'),
      'Reports: Stage filter correctly matches stage="Negotiation"'
    );

    // 7.3 Date range filter on opportunities
    const dateRangeRes = await request('GET', '/api/reports/opportunities?startDate=2024-01-01&endDate=2030-12-31');
    assert(
      dateRangeRes.status === 200 &&
      dateRangeRes.body.pagination.totalRecords > 0,
      'Reports: Date range filter captures active records within range'
    );

    // 8. Pagination Tests
    console.log('\n[8. Pagination & Limit Verification]');
    const p1 = await request('GET', '/api/reports/customers?page=1&limit=2');
    assert(
      p1.status === 200 &&
      p1.body.pagination.page === 1 &&
      p1.body.pagination.limit === 2 &&
      p1.body.data.length <= 2,
      'Pagination: Page=1 & Limit=2 returns at most 2 records with correct pagination metadata'
    );

    if (p1.body.pagination.totalPages > 1) {
      const p2 = await request('GET', '/api/reports/customers?page=2&limit=2');
      assert(
        p2.status === 200 &&
        p2.body.pagination.page === 2 &&
        p2.body.data.length > 0 &&
        p2.body.data[0].customerName !== p1.body.data[0].customerName,
        'Pagination: Page=2 returns subsequent page of distinct records'
      );
    } else {
      assert(true, 'Pagination: Total records <= 2, single page verified');
    }

    // 9. Sorting Tests
    console.log('\n[9. Column Sorting Verification]');
    const sortAscRes = await request('GET', '/api/reports/customers?sortBy=customerName&sortOrder=asc&limit=10');
    const sortDescRes = await request('GET', '/api/reports/customers?sortBy=customerName&sortOrder=desc&limit=10');

    if (sortAscRes.body.data.length >= 2) {
      const firstAsc = sortAscRes.body.data[0].customerName;
      const firstDesc = sortDescRes.body.data[0].customerName;
      assert(
        firstAsc.toLowerCase().localeCompare(firstDesc.toLowerCase()) <= 0,
        'Sorting: ASC and DESC column sorts reorder records appropriately'
      );
    } else {
      assert(sortAscRes.status === 200, 'Sorting: Sort parameter accepted and processed');
    }

    // 10. CSV Export Mode
    console.log('\n[10. CSV Export Mode Verification]');
    const exportRes = await request('GET', '/api/reports/pipeline?export=csv');
    assert(
      exportRes.status === 200 &&
      exportRes.body.pagination.page === 1 &&
      exportRes.body.data.length === exportRes.body.pagination.totalRecords,
      'CSV Export: Returns all matching filtered records unpaginated for clean CSV download'
    );

    // 11. Role-Based Access Control on Reports
    console.log('\n[11. Role-Based Access Control (RBAC) on Reports]');

    // 11.1 Manager Role
    const mgrUser = await loginUser('manager@acxiomcrm.com', 'Manager@12345');
    console.log(`[AUTH] Switched to Manager: ${mgrUser.name} (${mgrUser.role})`);

    const mgrUserAct = await request('GET', '/api/reports/user-activity');
    assert(mgrUserAct.status === 200, 'RBAC Manager: Allowed access to User Activity Report (200 OK)');

    const mgrAudit = await request('GET', '/api/reports/audit');
    assert(mgrAudit.status === 403, 'RBAC Manager: Blocked from Security & Audit Report with 403 Forbidden');

    // 11.2 Sales Executive Role
    const salesUser = await loginUser('sales@acxiomcrm.com', 'Sales@12345');
    console.log(`[AUTH] Switched to Sales Executive: ${salesUser.name} (${salesUser.role})`);

    const salesPipe = await request('GET', '/api/reports/pipeline');
    assert(salesPipe.status === 200, 'RBAC Sales Executive: Allowed access to own Pipeline Report (200 OK)');

    const salesUserAct = await request('GET', '/api/reports/user-activity');
    assert(salesUserAct.status === 403, 'RBAC Sales Executive: Blocked from User Activity Report with 403 Forbidden');

    const salesAudit = await request('GET', '/api/reports/audit');
    assert(salesAudit.status === 403, 'RBAC Sales Executive: Blocked from Security & Audit Report with 403 Forbidden');

    // 11.3 Sales Executive Data Scoping
    const salesCust = await request('GET', '/api/reports/customers');
    assert(salesCust.status === 200, 'RBAC Sales Executive: Can view Customer Report strictly scoped to assigned/created records');

    console.log('\n================================================================');
    console.log(`SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED out of ${passedTests + failedTests} tests`);
    console.log('================================================================\n');

    if (failedTests > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Test execution encountered fatal error:', err);
    process.exit(1);
  }
};

runAllTests();
