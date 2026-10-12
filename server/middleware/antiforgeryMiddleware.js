const crypto = require('crypto');

const getCsrfSecret = () => {
  return process.env.CSRF_SECRET || process.env.JWT_SECRET || 'acxiom_crm_antiforgery_internal_secret_key_32';
};

const generateSignedToken = () => {
  const nonce = crypto.randomBytes(32).toString('hex');
  const signature = crypto.createHmac('sha256', getCsrfSecret()).update(nonce).digest('hex');
  return `${nonce}.${signature}`;
};

const verifySignedToken = (token) => {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [nonce, signature] = parts;
  if (!nonce || !signature) return false;
  const expectedSig = crypto.createHmac('sha256', getCsrfSecret()).update(nonce).digest('hex');
  if (signature.length !== expectedSig.length) return false;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig));
};

/**
 * ASP.NET Core Anti-Forgery Security Middleware
 * Validates RequestVerificationToken / X-CSRF-TOKEN on state-changing requests against cookie & signature
 */
const antiforgeryHandler = (req, res, next) => {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];

  // Automatically attach/refresh token cookie on GET requests if not present
  const currentCookie = req.cookies?.['.AspNetCore.Antiforgery'] || req.cookies?.['XSRF-TOKEN'];
  if (!currentCookie || !verifySignedToken(currentCookie)) {
    const newToken = generateSignedToken();
    res.cookie('.AspNetCore.Antiforgery', newToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    });
    res.cookie('XSRF-TOKEN', newToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    });
  }

  // Safe read-only methods don't require token submission
  if (safeMethods.includes(req.method)) {
    return next();
  }

  // Public unauthenticated auth endpoints bypass state-changing CSRF
  const exemptPaths = ['/api/auth/login', '/api/auth/register', '/api/antiforgery/token'];
  if (exemptPaths.some((p) => req.path.startsWith(p))) {
    return next();
  }

  // State-changing CRM actions require valid Anti-Forgery token
  const headerToken =
    req.headers['requestverificationtoken'] ||
    req.headers['x-csrf-token'] ||
    req.headers['x-xsrf-token'] ||
    req.body?.__RequestVerificationToken;

  const cookieToken = req.cookies?.['.AspNetCore.Antiforgery'] || req.cookies?.['XSRF-TOKEN'];

  if (!headerToken) {
    return res.status(403).json({
      success: false,
      message: 'Anti-forgery token is missing in request headers. Protected state-changing requests require RequestVerificationToken.'
    });
  }

  if (!cookieToken) {
    return res.status(403).json({
      success: false,
      message: 'Anti-forgery cookie is missing. Please refresh session and try again.'
    });
  }

  if (headerToken !== cookieToken) {
    return res.status(403).json({
      success: false,
      message: 'Anti-forgery token mismatch between header and cookie.'
    });
  }

  if (!verifySignedToken(headerToken)) {
    return res.status(403).json({
      success: false,
      message: 'Invalid or forged anti-forgery token signature.'
    });
  }

  req.antiforgeryVerified = true;
  next();
};

const issueAntiforgeryToken = (req, res) => {
  const token = generateSignedToken();
  res.cookie('.AspNetCore.Antiforgery', token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/'
  });
  res.cookie('XSRF-TOKEN', token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/'
  });

  res.json({
    success: true,
    token,
    headerName: 'RequestVerificationToken'
  });
};

module.exports = { antiforgeryHandler, issueAntiforgeryToken, generateSignedToken, verifySignedToken };
