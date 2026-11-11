const crypto = require('crypto');
const { findUserById, findUserByEmail } = require('../modules/auth/auth.repository');
const { verifyPassword } = require('../utils/security');
const config = require('./admin.config');

/** Roles that may use the panel */
const panelRoles = () => [config.role, config.staffRole];

/**
 * A short fingerprint of the password hash, kept in the login session:
 * when the password changes, the fingerprint no longer matches and the login ends.
 */
const passwordStamp = (passwordHash) =>
  crypto.createHash('sha256').update(String(passwordHash)).digest('hex').slice(0, 16);

/**
 * Check an admin panel login. Only admins and staff get in; everyone else
 * sees the same "wrong email or password" message.
 * @returns {Promise<{ id: string, email: string, role: string, title: string, stamp: string } | null>}
 */
async function authenticate(email, password) {
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    return null;
  }

  const user = await findUserByEmail(email.trim().toLowerCase());
  // Checked even when there is no such user, so response times don't reveal which emails exist
  const valid = await verifyPassword(password, user?.passwordHash);

  if (!user || !valid || !panelRoles().includes(user.role)) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    title: user.name || user.email,
    stamp: passwordStamp(user.passwordHash),
  };
}

const RECHECK_MS = 30 * 1000;

/**
 * Runs before every panel request: a login ends as soon as the user is deleted,
 * loses the admin / staff role, or gets a new password (checked every 30 seconds).
 * A role change between admin and staff applies right away.
 */
async function checkSession(req, res, next) {
  const adminUser = req.session?.adminUser;
  if (!adminUser || Date.now() - (req.session.adminCheckedAt || 0) < RECHECK_MS) {
    next();
    return;
  }

  try {
    const user = await findUserById(adminUser.id);
    if (!user || !panelRoles().includes(user.role) || passwordStamp(user.passwordHash) !== adminUser.stamp) {
      req.session.destroy(() => res.redirect(`${config.path}/login`));
      return;
    }

    adminUser.role = user.role;
    adminUser.title = user.name || user.email;
    req.session.adminCheckedAt = Date.now();
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = { authenticate, checkSession, panelRoles, passwordStamp };
