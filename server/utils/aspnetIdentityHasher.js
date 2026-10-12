const crypto = require('crypto');
const bcrypt = require('bcryptjs');

/**
 * ASP.NET Core Identity V3 PasswordHasher Implementation
 * Conforms to Microsoft.AspNetCore.Identity.PasswordHasher<TUser>
 * Format:
 *   [0]: 0x01 (Version 3)
 *   [1..4]: PRF (HMACSHA256 = 1)
 *   [5..8]: Iteration count (10,000)
 *   [9..12]: Salt length (16 bytes)
 *   [13..28]: Salt (16 bytes)
 *   [29..60]: Derived Subkey (32 bytes)
 * Output: Base64 string starting with AQAAAA...
 */

const hashPassword = (password) => {
  const salt = crypto.randomBytes(16);
  const iterations = 10000;
  const subkey = crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256');

  const output = Buffer.alloc(1 + 4 + 4 + 4 + 16 + 32);
  output[0] = 0x01; // Format marker: Version 3
  output.writeUInt32BE(1, 1); // PRF: HMACSHA256
  output.writeUInt32BE(iterations, 5); // 10000 iterations
  output.writeUInt32BE(16, 9); // 16 bytes salt
  salt.copy(output, 13);
  subkey.copy(output, 29);

  return output.toString('base64');
};

const verifyPassword = (password, hashedPassword) => {
  if (!password || !hashedPassword) return false;

  // Support legacy/fallback bcrypt hashes seamlessly
  if (hashedPassword.startsWith('$2a$') || hashedPassword.startsWith('$2b$')) {
    return bcrypt.compareSync(password, hashedPassword);
  }

  try {
    const decoded = Buffer.from(hashedPassword, 'base64');
    if (decoded.length < 61) return false;
    if (decoded[0] !== 0x01) return false;

    const iterations = decoded.readUInt32BE(5);
    const saltLength = decoded.readUInt32BE(9);
    if (saltLength !== 16) return false;

    const salt = decoded.subarray(13, 13 + saltLength);
    const expectedSubkey = decoded.subarray(13 + saltLength, 13 + saltLength + 32);

    const actualSubkey = crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256');
    return crypto.timingSafeEqual(expectedSubkey, actualSubkey);
  } catch (err) {
    return false;
  }
};

module.exports = {
  hashPassword,
  verifyPassword
};
