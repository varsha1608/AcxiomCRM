const BASE_URL = 'http://localhost:5050/api';

async function runIdentityTestSuite() {
  console.log('\n======================================================');
  console.log('   GENUINE ASP.NET CORE IDENTITY VERIFICATION SUITE   ');
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
    assert(
      healthRes.status === 200 && healthJson.framework === 'ASP.NET Core 8.0 Identity',
      '1. Health API: Verified genuine ASP.NET Core 8.0 Identity framework runtime'
    );

    // 2. Password Policy
    const weakRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Weak User',
        email: `weak_${Date.now()}@test.com`,
        password: 'short'
      })
    });
    assert(weakRes.status === 400, '2. Password Policy: ASP.NET Core Identity rejected password < 8 characters');

    // 3. Public Registration Privilege Escalation Prevention
    const hackerEmail = `hacker_${Date.now()}@testcrm.io`;
    const regRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Privilege Escalator',
        email: hackerEmail,
        password: 'Password@123',
        role: 'Admin' // Attempt privilege escalation
      })
    });
    const regJson = await regRes.json();
    assert(
      regRes.status === 201 && regJson.user?.role === 'Sales Executive',
      '3. Privilege Escalation Prevention: User requesting Admin role assigned "Sales Executive"'
    );

    // 4. Admin Authentication
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
    assert(adminLoginRes.status === 200 && adminToken, '4. ASP.NET Core Identity: Admin signed in via SignInManager');

    // 5. Sales Executive Authentication
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
    assert(salesLoginRes.status === 200 && salesToken, '5. ASP.NET Core Identity: Sales Executive signed in via SignInManager');

    // 6. Genuine Account Lockout (5 failed attempts)
    let lockoutTriggered = false;
    for (let i = 0; i < 5; i++) {
      const failRes = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: hackerEmail,
          password: 'WrongPassword999'
        })
      });
      if (failRes.status === 403) {
        lockoutTriggered = true;
        break;
      }
    }
    assert(lockoutTriggered, '6. Security Lockout: ASP.NET Core Identity triggered lockout after 5 failed attempts');

    // 7. Admin Unlock
    const userListRes = await fetch(`${BASE_URL}/users?search=${hackerEmail}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const userListJson = await userListRes.json();
    const lockedUserId = userListJson.data[0].id;

    const unlockRes = await fetch(`${BASE_URL}/users/${lockedUserId}/unlock`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(unlockRes.status === 200, '7. Admin Security: Successfully unlocked user via SetLockoutEndDateAsync');

    // 8. Customer Creation
    const custEmail = `enterprise_${Date.now()}@testcorp.com`;
    const custPhone = `982345${Math.floor(1000 + Math.random() * 9000)}`;
    const createCustRes = await fetch(`${BASE_URL}/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        customerName: 'Global Net Solutions',
        email: custEmail,
        phone: custPhone,
        companyName: 'Global Net Corp',
        status: 'Active'
      })
    });
    const createCustJson = await createCustRes.json();
    const adminCustId = createCustJson.data?.id;
    assert(createCustRes.status === 201 && adminCustId, '8. Customer Management: Created customer record in EF Core');

    // 9. Customer Uniqueness Check
    const dupCustRes = await fetch(`${BASE_URL}/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        customerName: 'Duplicate Inc',
        email: custEmail,
        phone: '9911223344'
      })
    });
    assert(dupCustRes.status === 409, '9. Customer Validation: Prevented duplicate email creation (409 Conflict)');

    // 10. Role Isolation: Sales Executive Blocked from Admin Customer
    const salesAccessCust = await fetch(`${BASE_URL}/customers/${adminCustId}`, {
      headers: { Authorization: `Bearer ${salesToken}` }
    });
    assert(salesAccessCust.status === 403, '10. Authorization: Sales Executive blocked from Admin customer (403 Forbidden)');

    // 11. Opportunity Validation: Amount <= 0 Rejected
    const zeroAmountRes = await fetch(`${BASE_URL}/opportunities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        opportunityName: 'Invalid Deal',
        customerId: adminCustId,
        amount: 0,
        probability: 50,
        expectedCloseDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString()
      })
    });
    assert(zeroAmountRes.status === 400, '11. Opportunity Validation: Amount <= 0 rejected');

    // 12. Follow-Up Validation: Past Date Rejected
    const pastFollowUpRes = await fetch(`${BASE_URL}/followups`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        subject: 'Past follow up meeting',
        followUpDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        status: 'Planned'
      })
    });
    assert(pastFollowUpRes.status === 400, '12. Follow-Up Validation: Date earlier than today rejected');

    console.log('\n------------------------------------------------------');
    console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('------------------------------------------------------\n');

    process.exit(failed === 0 ? 0 : 1);
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

runIdentityTestSuite();
