const http = require('http');

let sessionCookies = {};

const parseSetCookie = (setCookieHeaders) => {
  if (!setCookieHeaders) return;
  const headers = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
  headers.forEach((h) => {
    const parts = h.split(';')[0].split('=');
    if (parts.length >= 2) {
      sessionCookies[parts[0].trim()] = parts.slice(1).join('=').trim();
    }
  });
};

const getCookieHeader = () => {
  return Object.entries(sessionCookies)
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

    const req = http.request(
      url,
      {
        method,
        headers: reqHeaders
      },
      (res) => {
        if (res.headers['set-cookie']) {
          parseSetCookie(res.headers['set-cookie']);
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

const getCsrfToken = async () => {
  const res = await request('GET', '/api/antiforgery/token');
  return res.body?.token;
};

const runTests = async () => {
  console.log('================================================================');
  console.log(' ACXIOMCRM MULTI-ROLE IDENTITY & AUTHORIZATION TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition, desc) => {
    if (condition) {
      console.log(`  ✓ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${desc}`);
      failed++;
    }
  };

  // Obtain initial CSRF token
  const csrfToken = await getCsrfToken();
  assert(!!csrfToken, 'Acquired Anti-Forgery CSRF token from server');

  // Helper for authenticated post with CSRF
  const authPost = async (path, token, body = {}) => {
    return await request(
      'POST',
      path,
      {
        Authorization: `Bearer ${token}`,
        RequestVerificationToken: csrfToken,
        'X-CSRF-TOKEN': csrfToken
      },
      body
    );
  };

  // Test 1: Admin Account (admin@acxiomcrm.com)
  console.log('\n--- Test Suite 1: Admin Account (admin@acxiomcrm.com) ---');
  {
    const loginRes = await request('POST', '/api/auth/login', {}, {
      email: 'admin@acxiomcrm.com',
      password: 'Admin@12345'
    });
    assert(loginRes.status === 200, 'Login status 200 OK');
    assert(loginRes.body.user?.role === 'Admin', `Role is Admin (got: ${loginRes.body.user?.role})`);
    assert(loginRes.body.user?.email === 'admin@acxiomcrm.com', 'Email matches admin@acxiomcrm.com');
    assert(loginRes.body.user?.name === 'Alexander Pierce (Admin)', `Name matches Alexander Pierce (got: ${loginRes.body.user?.name})`);
    assert(!!loginRes.body.token, 'JWT Token received');

    const token = loginRes.body.token;
    const authHeaders = { Authorization: `Bearer ${token}` };

    const meRes = await request('GET', '/api/auth/me', authHeaders);
    assert(meRes.status === 200 && meRes.body.user?.role === 'Admin', 'Auth/me returns Admin role');

    const usersRes = await request('GET', '/api/users', authHeaders);
    assert(usersRes.status === 200 && Array.isArray(usersRes.body.data), 'Admin access to /api/users is 200 OK');

    const auditRes = await request('GET', '/api/audit-logs', authHeaders);
    assert(auditRes.status === 200 && Array.isArray(auditRes.body.data), 'Admin access to /api/audit-logs is 200 OK');

    const dashRes = await request('GET', '/api/dashboard', authHeaders);
    assert(dashRes.status === 200, 'Admin access to /api/dashboard is 200 OK');
    assert(dashRes.body.adminStats !== null && typeof dashRes.body.adminStats === 'object', 'Admin dashboard includes adminStats');

    const logoutRes = await authPost('/api/auth/logout', token);
    assert(logoutRes.status === 200, 'Admin session logged out cleanly (200 OK)');
  }

  // Test 2: Admin Account (admin1@acxiomcrm.com)
  console.log('\n--- Test Suite 2: Admin Account (admin1@acxiomcrm.com) ---');
  {
    const loginRes = await request('POST', '/api/auth/login', {}, {
      email: 'admin1@acxiomcrm.com',
      password: 'Admin@12345'
    });
    assert(loginRes.status === 200, 'Login status 200 OK');
    assert(loginRes.body.user?.role === 'Admin', `Role is Admin (got: ${loginRes.body.user?.role})`);
    assert(loginRes.body.user?.email === 'admin1@acxiomcrm.com', 'Email matches admin1@acxiomcrm.com');
    assert(loginRes.body.user?.name === 'Varsha Kumari (Admin)', `Name is Varsha Kumari (Admin) (got: ${loginRes.body.user?.name})`);

    const token = loginRes.body.token;
    const authHeaders = { Authorization: `Bearer ${token}` };

    const meRes = await request('GET', '/api/auth/me', authHeaders);
    assert(meRes.status === 200 && meRes.body.user?.role === 'Admin', 'Auth/me returns Admin role');

    const usersRes = await request('GET', '/api/users', authHeaders);
    assert(usersRes.status === 200 && Array.isArray(usersRes.body.data), 'admin1 access to /api/users is 200 OK');

    const auditRes = await request('GET', '/api/audit-logs', authHeaders);
    assert(auditRes.status === 200 && Array.isArray(auditRes.body.data), 'admin1 access to /api/audit-logs is 200 OK');

    const logoutRes = await authPost('/api/auth/logout', token);
    assert(logoutRes.status === 200, 'admin1 session logged out cleanly (200 OK)');
  }

  // Test 3: Manager Account (manager@acxiomcrm.com)
  console.log('\n--- Test Suite 3: Manager Account (manager@acxiomcrm.com) ---');
  {
    const loginRes = await request('POST', '/api/auth/login', {}, {
      email: 'manager@acxiomcrm.com',
      password: 'Manager@12345'
    });
    assert(loginRes.status === 200, 'Login status 200 OK');
    assert(loginRes.body.user?.role === 'Manager', `Role is Manager (got: ${loginRes.body.user?.role})`);
    assert(loginRes.body.user?.name === 'Sarah Connor (Manager)', `Name is Sarah Connor (Manager)`);

    const token = loginRes.body.token;
    const authHeaders = { Authorization: `Bearer ${token}` };

    const meRes = await request('GET', '/api/auth/me', authHeaders);
    assert(meRes.status === 200 && meRes.body.user?.role === 'Manager', 'Auth/me returns Manager role');

    const dashRes = await request('GET', '/api/dashboard', authHeaders);
    assert(dashRes.status === 200, 'Manager access to /api/dashboard is 200 OK');
    assert(dashRes.body.adminStats === null, 'Manager dashboard adminStats is null (restricted)');

    const repRes = await request('GET', '/api/reports/pipeline', authHeaders);
    assert(repRes.status === 200, 'Manager access to /api/reports/pipeline is 200 OK');

    const usersRes = await request('GET', '/api/users', authHeaders);
    assert(usersRes.status === 403, 'Manager forbidden from /api/users (403 Forbidden)');

    const auditRes = await request('GET', '/api/audit-logs', authHeaders);
    assert(auditRes.status === 403, 'Manager forbidden from /api/audit-logs (403 Forbidden)');

    const logoutRes = await authPost('/api/auth/logout', token);
    assert(logoutRes.status === 200, 'Manager session logged out cleanly (200 OK)');
  }

  // Test 4: Sales Executive Account (sales@acxiomcrm.com)
  console.log('\n--- Test Suite 4: Sales Executive Account (sales@acxiomcrm.com) ---');
  {
    const loginRes = await request('POST', '/api/auth/login', {}, {
      email: 'sales@acxiomcrm.com',
      password: 'Sales@12345'
    });
    assert(loginRes.status === 200, 'Login status 200 OK');
    assert(loginRes.body.user?.role === 'Sales Executive', `Role is Sales Executive (got: ${loginRes.body.user?.role})`);
    assert(loginRes.body.user?.name === 'Marcus Vance (Sales)', `Name is Marcus Vance (Sales)`);

    const token = loginRes.body.token;
    const authHeaders = { Authorization: `Bearer ${token}` };

    const meRes = await request('GET', '/api/auth/me', authHeaders);
    assert(meRes.status === 200 && meRes.body.user?.role === 'Sales Executive', 'Auth/me returns Sales Executive role');

    const dashRes = await request('GET', '/api/dashboard', authHeaders);
    assert(dashRes.status === 200, 'Sales Exec access to /api/dashboard is 200 OK');
    assert(dashRes.body.adminStats === null, 'Sales Exec dashboard adminStats is null');

    const usersRes = await request('GET', '/api/users', authHeaders);
    assert(usersRes.status === 403, 'Sales Exec forbidden from /api/users (403 Forbidden)');

    const auditRes = await request('GET', '/api/audit-logs', authHeaders);
    assert(auditRes.status === 403, 'Sales Exec forbidden from /api/audit-logs (403 Forbidden)');

    const logoutRes = await authPost('/api/auth/logout', token);
    assert(logoutRes.status === 200, 'Sales Exec session logged out cleanly (200 OK)');
  }

  // Test 5: Security / Stale / Unauthenticated checks
  console.log('\n--- Test Suite 5: Token Validation & Stale Session Security ---');
  {
    const noTokenRes = await request('GET', '/api/dashboard', {});
    assert(noTokenRes.status === 401, 'No token returns 401 Unauthorized');

    const badTokenRes = await request('GET', '/api/dashboard', {
      Authorization: 'Bearer invalid.token.payload'
    });
    assert(badTokenRes.status === 401, 'Forged token returns 401 Unauthorized');

    const expiredTokenRes = await request('GET', '/api/dashboard', {
      Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY0MGExYjJjM2Q0ZTVmNmE3YjhkOWUxZiIsImlhdCI6MTYwMDAwMDAwMCwiZXhwIjoxNjAwMDAwMDAxfQ.signature'
    });
    assert(expiredTokenRes.status === 401, 'Expired/bogus token returns 401 Unauthorized');
  }

  // Test 6: Invalid Credentials & Rejection Behavior (No Default User Fallback)
  console.log('\n--- Test Suite 6: Invalid & Unknown Credentials Rejection ---');
  {
    // Case 1: Incorrect password for Admin
    const badPassRes = await request('POST', '/api/auth/login', {}, {
      email: 'admin@acxiomcrm.com',
      password: 'IncorrectPassword!999'
    });
    assert(badPassRes.status === 401, 'Incorrect password rejected with 401 Unauthorized');
    assert(badPassRes.body.success === false, 'success is false');
    assert(!badPassRes.body.token, 'No token returned on incorrect password');
    assert(!badPassRes.body.user, 'No fallback user object returned on incorrect password');
    assert(badPassRes.body.message?.includes('Invalid email or password'), 'Proper error message returned');

    // Case 2: Unknown email
    const unknownEmailRes = await request('POST', '/api/auth/login', {}, {
      email: 'nonexistent_account@acxiomcrm.com',
      password: 'SomePassword!123'
    });
    assert(unknownEmailRes.status === 401, 'Unknown email rejected with 401 Unauthorized');
    assert(unknownEmailRes.body.success === false, 'success is false');
    assert(!unknownEmailRes.body.token, 'No token returned on unknown email');
    assert(!unknownEmailRes.body.user, 'No fallback user object returned on unknown email');

    // Case 3: Missing fields
    const missingRes = await request('POST', '/api/auth/login', {}, {
      email: '',
      password: ''
    });
    assert(missingRes.status === 400, 'Empty credentials rejected with 400 Bad Request');
    assert(missingRes.body.success === false, 'success is false');
    assert(!missingRes.body.token, 'No token returned on empty credentials');
  }

  console.log('\n================================================================');
  console.log(` FINAL RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) process.exit(1);
  else process.exit(0);
};

runTests().catch((e) => {
  console.error('Test execution error:', e);
  process.exit(1);
});
