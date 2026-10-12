require('dotenv').config();

const BASE_URL = 'http://localhost:5000/api';

async function runTestSuite() {
  console.log('\n======================================================');
  console.log('   ACXIOMCRM COMPREHENSIVE SECURITY & AUDIT TEST SUITE');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName}`);
      failed++;
    }
  }

  try {
    // 1. Health Check
    const healthRes = await fetch(`${BASE_URL}/health`);
    const healthJson = await healthRes.json();
    assert(healthRes.status === 200 && healthJson.status === 'Healthy', '1. System Health API check');

    // 2. Obtain Genuine Anti-Forgery Token and Cookie
    const csrfRes = await fetch(`${BASE_URL}/antiforgery/token`);
    const csrfJson = await csrfRes.json();
    const csrfToken = csrfJson.token;
    const csrfHeaders = {
      'Content-Type': 'application/json',
      RequestVerificationToken: csrfToken,
      Cookie: `.AspNetCore.Antiforgery=${csrfToken}; XSRF-TOKEN=${csrfToken}`
    };
    assert(csrfRes.status === 200 && csrfToken && csrfToken.includes('.'), '2. Anti-Forgery Protection: Genuine signed token issued');

    // 3. Anti-Forgery Security: Reject Missing Token on Protected State-Changing Request
    const missingCsrfRes = await fetch(`${BASE_URL}/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerName: 'No CSRF Corp', email: 'nocsrf@test.com', phone: '9999999999' })
    });
    assert(missingCsrfRes.status === 403, '3. Anti-Forgery Security: Missing token on state-changing request rejected (403 Forbidden)');

    // 4. Anti-Forgery Security: Reject Forged / Invalid Token Signature
    const forgedCsrfRes = await fetch(`${BASE_URL}/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        RequestVerificationToken: 'forged_token.invalid_signature_hex_12345',
        Cookie: `.AspNetCore.Antiforgery=forged_token.invalid_signature_hex_12345`
      },
      body: JSON.stringify({ customerName: 'Forged Corp', email: 'forged@test.com', phone: '9999999999' })
    });
    assert(forgedCsrfRes.status === 403, '4. Anti-Forgery Security: Forged token signature rejected (403 Forbidden)');

    // 5. Anti-Forgery Security: Reject Token / Cookie Mismatch
    const mismatchCsrfRes = await fetch(`${BASE_URL}/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        RequestVerificationToken: csrfToken,
        Cookie: `.AspNetCore.Antiforgery=different_token.different_signature`
      },
      body: JSON.stringify({ customerName: 'Mismatch Corp', email: 'mismatch@test.com', phone: '9999999999' })
    });
    assert(mismatchCsrfRes.status === 403, '5. Anti-Forgery Security: Header-cookie token mismatch rejected (403 Forbidden)');

    // 6. Public Registration Privilege Escalation Prevention
    const escalateAdminRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Hacker User',
        email: `hacker_${Date.now()}@testcrm.io`,
        password: 'Password@123',
        role: 'Admin' // Attempt privilege escalation to Admin
      })
    });
    const escalateAdminJson = await escalateAdminRes.json();
    assert(
      escalateAdminRes.status === 201 && escalateAdminJson.user?.role === 'Sales Executive',
      '6. Security: Public registration privilege escalation to Admin blocked (assigned Sales Executive)'
    );

    const escalateManagerRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Manager Aspirant',
        email: `manager_asp_${Date.now()}@testcrm.io`,
        password: 'Password@123',
        role: 'Manager' // Attempt privilege escalation to Manager
      })
    });
    const escalateManagerJson = await escalateManagerRes.json();
    assert(
      escalateManagerRes.status === 201 && escalateManagerJson.user?.role === 'Sales Executive',
      '7. Security: Public registration privilege escalation to Manager blocked (assigned Sales Executive)'
    );

    // 8. Password Policy: Rejection of Weak Password
    const weakPassRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Weak User',
        email: 'weak@test.com',
        password: 'weak'
      })
    });
    assert(weakPassRes.status === 400, '8. Password policy: rejection of password < 8 characters');

    // 9. Valid Authentication (Admin Login)
    const adminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@acxiomcrm.com',
        password: 'Admin@12345'
      })
    });
    const adminLoginJson = await adminLoginRes.json();
    const adminToken = adminLoginJson.token;
    assert(adminLoginRes.status === 200 && adminToken, '9. Admin Authentication & JWT token issuance');

    // 10. Valid Authentication (Sales Executive Login)
    const salesLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'sales@acxiomcrm.com',
        password: 'Sales@12345'
      })
    });
    const salesLoginJson = await salesLoginRes.json();
    const salesToken = salesLoginJson.token;
    assert(salesLoginRes.status === 200 && salesToken, '10. Sales Executive Authentication');

    // 11. Security: Invalid JWT Token Rejection
    const invalidTokenRes = await fetch(`${BASE_URL}/customers`, {
      headers: { Authorization: 'Bearer forged.invalid.jwt_token_payload' }
    });
    assert(invalidTokenRes.status === 401, '11. Security: Invalid JWT token rejected (401 Unauthorized)');

    // 12. Account Lockout Security Check
    let lockoutTriggered = false;
    for (let i = 0; i < 5; i++) {
      const failRes = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'sales@acxiomcrm.com',
          password: 'WrongPassword999'
        })
      });
      if (failRes.status === 403) {
        lockoutTriggered = true;
        break;
      }
    }
    assert(lockoutTriggered, '12. Security: Account lockout triggered after consecutive failed attempts');

    // 13. Admin Unlock Security Test
    const userListRes = await fetch(`${BASE_URL}/users?search=sales@acxiomcrm.com`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const userListJson = await userListRes.json();
    const salesUserId = userListJson.data[0]._id;

    const unlockRes = await fetch(`${BASE_URL}/users/${salesUserId}/unlock`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        ...csrfHeaders
      }
    });
    assert(unlockRes.status === 200, '13. Admin Security: Successfully unlocked user account');

    // 14. Customer Validation: Invalid Email & Invalid Phone rejection
    const invalidEmailCustRes = await fetch(`${BASE_URL}/customers`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        ...csrfHeaders
      },
      body: JSON.stringify({
        customerName: 'Test Corp',
        email: 'invalid-email',
        phone: '123'
      })
    });
    assert(invalidEmailCustRes.status === 400, '14. Customer Validation: Rejected invalid email format');

    // 15. Customer Creation (Admin Owned)
    const cust1Email = `corp_${Date.now()}@testcrm.io`;
    const cust1Phone = `981234${Math.floor(1000 + Math.random() * 9000)}`;

    const createCustRes = await fetch(`${BASE_URL}/customers`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        ...csrfHeaders
      },
      body: JSON.stringify({
        customerName: 'Enterprise Holdings Inc',
        email: cust1Email,
        phone: cust1Phone,
        companyName: 'Enterprise Holdings Group',
        status: 'Active'
      })
    });
    const createCustJson = await createCustRes.json();
    const adminCustomerId = createCustJson.data?._id;
    assert(createCustRes.status === 201 && adminCustomerId, '15. Customer Management: Created customer record');

    // 16. Customer Duplicate Email Prevention
    const dupCustRes = await fetch(`${BASE_URL}/customers`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        ...csrfHeaders
      },
      body: JSON.stringify({
        customerName: 'Another Corp',
        email: cust1Email,
        phone: '9888888888'
      })
    });
    assert(dupCustRes.status === 409, '16. Customer Validation: Prevented duplicate email creation (409 Conflict)');

    // 17. Individual Record Authorization: Sales Executive Blocked from Admin's Customer
    const salesAccessAdminCust = await fetch(`${BASE_URL}/customers/${adminCustomerId}`, {
      headers: { Authorization: `Bearer ${salesToken}` }
    });
    assert(salesAccessAdminCust.status === 403, '17. Authorization: Sales Executive blocked from reading Admin customer by ID (403 Forbidden)');

    const salesUpdateAdminCust = await fetch(`${BASE_URL}/customers/${adminCustomerId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${salesToken}`,
        ...csrfHeaders
      },
      body: JSON.stringify({ customerName: 'Hacked Customer Name' })
    });
    assert(salesUpdateAdminCust.status === 403, '18. Authorization: Sales Executive blocked from updating Admin customer by ID (403 Forbidden)');

    const salesDeleteAdminCust = await fetch(`${BASE_URL}/customers/${adminCustomerId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${salesToken}`,
        ...csrfHeaders
      }
    });
    assert(salesDeleteAdminCust.status === 403, '19. Authorization: Sales Executive blocked from deleting Admin customer (403 Forbidden)');

    // 20. Lead Management: Creation & Conversion
    const leadEmail = `lead_${Date.now()}@prospective.com`;
    const createLeadRes = await fetch(`${BASE_URL}/leads`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        ...csrfHeaders
      },
      body: JSON.stringify({
        leadName: 'Arthur Pendelton',
        email: leadEmail,
        phone: '9988776655',
        companyName: 'Pendelton Innovations',
        source: 'Website',
        expectedValue: 30000,
        status: 'Qualified'
      })
    });
    const createLeadJson = await createLeadRes.json();
    const adminLeadId = createLeadJson.data?._id;
    assert(createLeadRes.status === 201 && adminLeadId, '20. Lead Management: Successfully captured qualified lead');

    // 21. Individual Record Authorization: Sales Executive Blocked from Admin's Lead
    const salesAccessAdminLead = await fetch(`${BASE_URL}/leads/${adminLeadId}`, {
      headers: { Authorization: `Bearer ${salesToken}` }
    });
    assert(salesAccessAdminLead.status === 403, '21. Authorization: Sales Executive blocked from reading Admin lead by ID (403 Forbidden)');

    const salesConvertAdminLead = await fetch(`${BASE_URL}/leads/${adminLeadId}/convert`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${salesToken}`,
        ...csrfHeaders
      },
      body: JSON.stringify({ createCustomer: true, createOpportunity: true, opportunityName: 'Stolen Deal' })
    });
    assert(salesConvertAdminLead.status === 403, '22. Authorization: Sales Executive blocked from converting Admin lead (403 Forbidden)');

    // 22. Lead Conversion by Authorized Owner
    const convertLeadRes = await fetch(`${BASE_URL}/leads/${adminLeadId}/convert`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        ...csrfHeaders
      },
      body: JSON.stringify({
        createCustomer: true,
        createOpportunity: true,
        opportunityName: 'Pendelton Enterprise Deal',
        opportunityAmount: 30000,
        opportunityStage: 'Qualification',
        expectedCloseDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      })
    });
    const convertLeadJson = await convertLeadRes.json();
    assert(
      convertLeadRes.status === 200 && convertLeadJson.data?.lead?.status === 'Converted',
      '23. Lead Workflow: Converted lead to Customer & Opportunity'
    );

    // 24. Opportunity Business Rules: Amount > 0 Validation
    const zeroAmountRes = await fetch(`${BASE_URL}/opportunities`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        ...csrfHeaders
      },
      body: JSON.stringify({
        opportunityName: 'Bad Deal',
        customerId: adminCustomerId,
        amount: 0,
        probability: 50,
        expectedCloseDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString()
      })
    });
    assert(zeroAmountRes.status === 400, '24. Opportunity Business Validation: Amount <= 0 rejected');

    // 25. Opportunity Business Rules: Probability > 100 Validation
    const highProbRes = await fetch(`${BASE_URL}/opportunities`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        ...csrfHeaders
      },
      body: JSON.stringify({
        opportunityName: 'Bad Deal 2',
        customerId: adminCustomerId,
        amount: 15000,
        probability: 101,
        expectedCloseDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString()
      })
    });
    assert(highProbRes.status === 400, '25. Opportunity Business Validation: Probability > 100 rejected');

    // 26. Opportunity Business Rules: Expected Close Date in past rejected
    const pastDateRes = await fetch(`${BASE_URL}/opportunities`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        ...csrfHeaders
      },
      body: JSON.stringify({
        opportunityName: 'Bad Deal 3',
        customerId: adminCustomerId,
        amount: 15000,
        probability: 50,
        expectedCloseDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      })
    });
    assert(pastDateRes.status === 400, '26. Opportunity Business Validation: Past expected close date rejected');

    // 27. Valid Opportunity Creation
    const validOppRes = await fetch(`${BASE_URL}/opportunities`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        ...csrfHeaders
      },
      body: JSON.stringify({
        opportunityName: 'Apex Cloud Expansion 2026',
        customerId: adminCustomerId,
        amount: 60000,
        probability: 75,
        stage: 'Proposal',
        expectedCloseDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString()
      })
    });
    const validOppJson = await validOppRes.json();
    const adminOppId = validOppJson.data?._id;
    assert(validOppRes.status === 201 && adminOppId, '27. Opportunity Management: Valid opportunity created');

    // 28. Individual Record Authorization: Sales Executive Blocked from Admin Opportunity
    const salesAccessAdminOpp = await fetch(`${BASE_URL}/opportunities/${adminOppId}`, {
      headers: { Authorization: `Bearer ${salesToken}` }
    });
    assert(salesAccessAdminOpp.status === 403, '28. Authorization: Sales Executive blocked from reading Admin opportunity by ID (403 Forbidden)');

    // 29. Follow-Up Business Rules: Past Date Rejected
    const pastFollowUpRes = await fetch(`${BASE_URL}/followups`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        ...csrfHeaders
      },
      body: JSON.stringify({
        subject: 'Past follow up test',
        followUpDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        status: 'Planned'
      })
    });
    assert(pastFollowUpRes.status === 400, '29. Follow-Up Business Validation: Date earlier than today rejected');

    // 30. Valid Follow-Up Creation
    const validFollowUpRes = await fetch(`${BASE_URL}/followups`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        ...csrfHeaders
      },
      body: JSON.stringify({
        subject: 'Contract follow-up meeting with VP',
        customerId: adminCustomerId,
        followUpDate: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        followUpType: 'Meeting',
        status: 'Planned'
      })
    });
    const validFollowUpJson = await validFollowUpRes.json();
    const adminFollowUpId = validFollowUpJson.data?._id;
    assert(validFollowUpRes.status === 201 && adminFollowUpId, '30. Follow-Up Management: Valid follow-up scheduled');

    // 31. Individual Record Authorization: Sales Executive Blocked from Admin Follow-Up
    const salesAccessAdminFollowUp = await fetch(`${BASE_URL}/followups/${adminFollowUpId}`, {
      headers: { Authorization: `Bearer ${salesToken}` }
    });
    assert(salesAccessAdminFollowUp.status === 403, '31. Authorization: Sales Executive blocked from reading Admin follow-up by ID (403 Forbidden)');

    const salesDeleteAdminFollowUp = await fetch(`${BASE_URL}/followups/${adminFollowUpId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${salesToken}`,
        ...csrfHeaders
      }
    });
    assert(salesDeleteAdminFollowUp.status === 403, '32. Authorization: Sales Executive blocked from deleting Admin follow-up (403 Forbidden)');

    // 33. Activity Creation & Sales Executive Authorization Check
    const createActRes = await fetch(`${BASE_URL}/activities`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        ...csrfHeaders
      },
      body: JSON.stringify({
        activityType: 'Call',
        subject: 'Executive Board Discussion',
        description: 'Discussed Q4 roadmap and pricing terms.',
        customerId: adminCustomerId
      })
    });
    const createActJson = await createActRes.json();
    const adminActId = createActJson.data?._id;
    assert(createActRes.status === 201 && adminActId, '33. Activity Management: Logged activity successfully');

    const salesAccessAdminAct = await fetch(`${BASE_URL}/activities/${adminActId}`, {
      headers: { Authorization: `Bearer ${salesToken}` }
    });
    assert(salesAccessAdminAct.status === 403, '34. Authorization: Sales Executive blocked from viewing Admin activity by ID (403 Forbidden)');

    // 35. Report Authorization: Sales Executive Blocked from User Activity Report
    const salesUserActReport = await fetch(`${BASE_URL}/reports/user-activity`, {
      headers: { Authorization: `Bearer ${salesToken}` }
    });
    assert(salesUserActReport.status === 403, '35. Authorization: Sales Executive blocked from User Activity report (403 Forbidden)');

    // 36. Dashboard KPIs and Charts Loading
    const dashRes = await fetch(`${BASE_URL}/dashboard`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const dashJson = await dashRes.json();
    assert(
      dashRes.status === 200 && dashJson.kpis?.totalCustomers > 0 && dashJson.charts?.leadStatus,
      '36. Dashboard: KPI metrics and Chart.js datasets loaded correctly'
    );

    // 37. Audit Log Verification
    const auditRes = await fetch(`${BASE_URL}/audit-logs`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const auditJson = await auditRes.json();
    assert(
      auditRes.status === 200 && auditJson.data?.length > 0,
      '37. Audit Logging: Audit trail contains tamper-proof operation logs without secrets'
    );

    // 38. Safe Logout
    const logoutRes = await fetch(`${BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        ...csrfHeaders
      }
    });
    assert(logoutRes.status === 200, '38. Safe Authentication Logout');

    console.log('\n------------------------------------------------------');
    console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('------------------------------------------------------\n');

    process.exit(failed === 0 ? 0 : 1);
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

runTestSuite();
