const http = require('http');
const mongoose = require('mongoose');
require('dotenv').config();
const User = require('../models/User');

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
  console.log('========================================================================');
  console.log(' ACXIOMCRM REGISTRATION, AUTHENTICATION & REDESIGN VERIFICATION SUITE');
  console.log('========================================================================\n');

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

  const csrfToken = await getCsrfToken();
  assert(!!csrfToken, '1. Acquired Anti-Forgery CSRF token from server');

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

  // Connect to MongoDB to check database persistence directly
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/acxiomcrm');
  console.log('  ✓ Connected to MongoDB for database persistence verification\n');

  // Test 1: New User Registration
  console.log('--- Test 1: Real User Registration Flow ---');
  const testEmail = `newuser_${Date.now()}@acxiomcrm.com`;
  const testPassword = 'Password@2026';
  const testName = 'Alex Rivera';

  const regRes = await request('POST', '/api/auth/register', {
    RequestVerificationToken: csrfToken,
    'X-CSRF-TOKEN': csrfToken
  }, {
    name: testName,
    email: testEmail,
    password: testPassword
  });

  assert(regRes.status === 201, 'Registration returns 201 Created');
  assert(regRes.body.success === true, 'Registration success is true');
  assert(regRes.body.user?.email === testEmail.toLowerCase(), 'Registration returned user email matches');
  assert(regRes.body.user?.name === testName, 'Registration returned user name matches');
  assert(regRes.body.user?.role === 'Sales Executive', 'Public registration assigned least-privileged Sales Executive role');
  assert(!!regRes.body.token, 'Registration returned valid JWT token');

  // Test 2: Database Persistence
  console.log('\n--- Test 2: Database Persistence Verification ---');
  const dbUser = await User.findOne({ email: testEmail.toLowerCase() });
  assert(!!dbUser, 'User is persisted in MongoDB');
  assert(dbUser.name === testName, 'Database user name matches registered name');
  assert(dbUser.role === 'Sales Executive', 'Database user role is Sales Executive');
  assert(dbUser.emailConfirmed === true, 'Database emailConfirmed is true');
  assert(dbUser.isActive === true, 'Database isActive is true');

  // Test 3: Duplicate Registration Prevention
  console.log('\n--- Test 3: Duplicate Registration Rejection ---');
  const dupRes = await request('POST', '/api/auth/register', {
    RequestVerificationToken: csrfToken,
    'X-CSRF-TOKEN': csrfToken
  }, {
    name: 'Duplicate Attempt',
    email: testEmail,
    password: testPassword
  });
  assert(dupRes.status === 409, 'Duplicate registration returns 409 Conflict');
  assert(dupRes.body.success === false, 'success is false');
  assert(dupRes.body.message?.includes('already exists'), 'Friendly duplicate message returned');

  // Test 4: Password Policy and Format Validation
  console.log('\n--- Test 4: Registration Input Validation ---');
  const shortPassRes = await request('POST', '/api/auth/register', {
    RequestVerificationToken: csrfToken,
    'X-CSRF-TOKEN': csrfToken
  }, {
    name: 'Short Pass',
    email: 'shortpass@acxiomcrm.com',
    password: 'short'
  });
  assert(shortPassRes.status === 400, 'Password < 8 chars rejected with 400 Bad Request');

  const noNumPassRes = await request('POST', '/api/auth/register', {
    RequestVerificationToken: csrfToken,
    'X-CSRF-TOKEN': csrfToken
  }, {
    name: 'No Number',
    email: 'nonum@acxiomcrm.com',
    password: 'PasswordOnly'
  });
  assert(noNumPassRes.status === 400, 'Password without number rejected with 400 Bad Request');

  const badEmailRes = await request('POST', '/api/auth/register', {
    RequestVerificationToken: csrfToken,
    'X-CSRF-TOKEN': csrfToken
  }, {
    name: 'Bad Email',
    email: 'not-an-email',
    password: 'Password@123'
  });
  assert(badEmailRes.status === 400, 'Invalid email format rejected with 400 Bad Request');

  // Test 5: Login with Newly Registered User
  console.log('\n--- Test 5: Login with Newly Registered User ---');
  const loginRes = await request('POST', '/api/auth/login', {}, {
    email: testEmail,
    password: testPassword
  });
  assert(loginRes.status === 200, 'Login status 200 OK');
  assert(loginRes.body.user?.email === testEmail.toLowerCase(), 'Login returns registered user email');
  assert(loginRes.body.user?.name === testName, 'Login returns registered user name');
  assert(loginRes.body.user?.role === 'Sales Executive', 'Login returns registered user role (Sales Executive)');
  assert(!!loginRes.body.token, 'Login returns JWT token');

  const newAuthHeaders = { Authorization: `Bearer ${loginRes.body.token}` };
  const meRes = await request('GET', '/api/auth/me', newAuthHeaders);
  assert(meRes.status === 200, '/api/auth/me returns 200 OK');
  assert(meRes.body.user?.name === testName, '/api/auth/me matches registered user name');
  assert(meRes.body.user?.email === testEmail.toLowerCase(), '/api/auth/me matches registered email');
  assert(meRes.body.user?.role === 'Sales Executive', '/api/auth/me matches registered role');

  // Test 6: Incorrect Password on Newly Registered User
  console.log('\n--- Test 6: Incorrect Password Rejection ---');
  const badLoginRes = await request('POST', '/api/auth/login', {}, {
    email: testEmail,
    password: 'WrongPassword@999'
  });
  assert(badLoginRes.status === 401, 'Incorrect password rejected with 401 Unauthorized');
  assert(badLoginRes.body.success === false, 'success is false');
  assert(!badLoginRes.body.token, 'No token issued for bad password');
  assert(!badLoginRes.body.user, 'No fallback user returned for bad password');

  // Test 7: Independent Test of Demo Accounts
  console.log('\n--- Test 7: Demo Accounts Independent Verification ---');
  // 7A: Admin
  {
    const adminLogin = await request('POST', '/api/auth/login', {}, {
      email: 'admin@acxiomcrm.com',
      password: 'Admin@12345'
    });
    assert(adminLogin.status === 200 && adminLogin.body.user?.role === 'Admin', 'Admin logs in as Admin');
    const aHeaders = { Authorization: `Bearer ${adminLogin.body.token}` };
    const uRes = await request('GET', '/api/users', aHeaders);
    assert(uRes.status === 200, 'Admin accesses /api/users (200 OK)');
    const dRes = await request('GET', '/api/dashboard', aHeaders);
    assert(dRes.status === 200 && dRes.body.adminStats !== null, 'Admin accesses dashboard with adminStats');
    await authPost('/api/auth/logout', adminLogin.body.token);
  }

  // 7B: Manager
  {
    const mgrLogin = await request('POST', '/api/auth/login', {}, {
      email: 'manager@acxiomcrm.com',
      password: 'Manager@12345'
    });
    assert(mgrLogin.status === 200 && mgrLogin.body.user?.role === 'Manager', 'Manager logs in as Manager');
    const mHeaders = { Authorization: `Bearer ${mgrLogin.body.token}` };
    const repRes = await request('GET', '/api/reports/pipeline', mHeaders);
    assert(repRes.status === 200, 'Manager accesses /api/reports/pipeline (200 OK)');
    const uRes = await request('GET', '/api/users', mHeaders);
    assert(uRes.status === 403, 'Manager forbidden from /api/users (403 Forbidden)');
    const dRes = await request('GET', '/api/dashboard', mHeaders);
    assert(dRes.status === 200 && dRes.body.adminStats === null, 'Manager dashboard adminStats is null');
    await authPost('/api/auth/logout', mgrLogin.body.token);
  }

  // 7C: Sales Executive
  {
    const salesLogin = await request('POST', '/api/auth/login', {}, {
      email: 'sales@acxiomcrm.com',
      password: 'Sales@12345'
    });
    assert(salesLogin.status === 200 && salesLogin.body.user?.role === 'Sales Executive', 'Sales Exec logs in as Sales Executive');
    const sHeaders = { Authorization: `Bearer ${salesLogin.body.token}` };
    const uRes = await request('GET', '/api/users', sHeaders);
    assert(uRes.status === 403, 'Sales Exec forbidden from /api/users (403 Forbidden)');
    const dRes = await request('GET', '/api/dashboard', sHeaders);
    assert(dRes.status === 200 && dRes.body.adminStats === null, 'Sales Exec dashboard adminStats is null');
    await authPost('/api/auth/logout', salesLogin.body.token);
  }

  // Test 8: Logout and Stale Session Cleared
  console.log('\n--- Test 8: Logout & Stale Token Invalidation ---');
  const unauthRes = await request('GET', '/api/auth/me', {});
  assert(unauthRes.status === 401, 'Request without token returns 401 Unauthorized');

  console.log('\n========================================================================');
  console.log(` FINAL RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================');

  await mongoose.disconnect();
  if (failed > 0) process.exit(1);
  else process.exit(0);
};

runTests().catch((e) => {
  console.error('Test execution error:', e);
  process.exit(1);
});
