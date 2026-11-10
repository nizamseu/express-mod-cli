const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { jwtSecret, accessTokenExpiresIn } = require('../config/auth');

const BCRYPT_ROUNDS = 12;
let dummyHash;

/** Hash a password for storage */
async function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Check a password against a stored hash.
 * Without a hash (no account with that email) a dummy hash is checked anyway,
 * so the response time doesn't reveal whether the account exists.
 */
async function verifyPassword(password, hash) {
  if (!hash) {
    dummyHash ??= await bcrypt.hash('not-a-real-password', BCRYPT_ROUNDS);
    await bcrypt.compare(password, dummyHash);
    return false;
  }
  return bcrypt.compare(password, hash);
}

/**
 * Create a short-lived access token for a user
 * @param {{ id: string, role: string }} user
 * @returns {{ accessToken: string, expiresIn: number }} - expiresIn in seconds
 */
function signAccessToken(user) {
  const accessToken = jwt.sign({ role: user.role }, jwtSecret(), {
    subject: String(user.id),
    expiresIn: accessTokenExpiresIn(),
    algorithm: 'HS256',
  });
  const { exp, iat } = jwt.decode(accessToken);
  return { accessToken, expiresIn: exp - iat };
}

/**
 * Read the user from an access token. Throws a jsonwebtoken error when the
 * token is invalid or expired.
 * @returns {{ id: string, role: string }}
 */
function verifyAccessToken(token) {
  const payload = jwt.verify(token, jwtSecret(), { algorithms: ['HS256'] });
  return { id: payload.sub, role: payload.role };
}

/** A random, URL-safe token (refresh tokens) */
const generateToken = () => crypto.randomBytes(32).toString('base64url');

/** Tokens are stored as hashes, so a database leak doesn't expose usable tokens */
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

module.exports = {
  hashPassword,
  verifyPassword,
  signAccessToken,
  verifyAccessToken,
  generateToken,
  hashToken,
};
