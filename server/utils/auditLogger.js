const AuditLog = require('../models/AuditLog');

const sanitizeObject = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  const clone = JSON.parse(JSON.stringify(obj));
  const sensitiveKeys = [
    'password',
    'passwordhash',
    'token',
    'authorization',
    'secret',
    'securitystamp',
    'concurrencystamp',
    'cookie',
    'xsrf',
    'requestverificationtoken',
    'jwt'
  ];
  for (const key of Object.keys(clone)) {
    if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
      delete clone[key];
    } else if (typeof clone[key] === 'object') {
      clone[key] = sanitizeObject(clone[key]);
    }
  }
  return clone;
};

const logAudit = async ({
  req,
  user = null,
  action,
  entityName,
  recordId = '',
  details = '',
  result = 'SUCCESS',
  oldValue = null,
  newValue = null
}) => {
  try {
    const effectiveUser = user || (req && req.user);
    const ip = req
      ? req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || ''
      : '127.0.0.1';

    await AuditLog.create({
      userId: effectiveUser ? effectiveUser._id : null,
      userName: effectiveUser ? effectiveUser.name : 'System/Guest',
      userRole: effectiveUser ? effectiveUser.role : 'Anonymous',
      action,
      entityName,
      recordId: recordId ? recordId.toString() : '',
      details,
      result,
      oldValue: sanitizeObject(oldValue),
      newValue: sanitizeObject(newValue),
      ipAddress: ip.toString()
    });
  } catch (err) {
    console.error('[AuditLog Error]', err.message);
  }
};

module.exports = { logAudit, sanitizeObject };
