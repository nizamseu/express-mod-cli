const { Op } = require('sequelize');
const UserModel = require('./user.model');
const RefreshTokenModel = require('./refresh-token.model');
const AuthTokenModel = require('./auth-token.model');

/**
 * Database access for authentication (PostgreSQL / MySQL).
 * Returns plain objects, so the controller works the same with every database.
 * The user object includes passwordHash - never send it to clients.
 */

const toUser = (row) =>
  row && {
    id: String(row.id),
    email: row.email,
    name: row.name ?? null,
    role: row.role,
    passwordHash: row.passwordHash,
    emailVerifiedAt: row.emailVerifiedAt ?? null,
    createdAt: row.createdAt
  };

const toToken = (row) =>
  row && {
    id: String(row.id),
    userId: String(row.userId),
    familyId: row.familyId,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt
  };

/** Ids are auto-increment integers - anything else cannot match a row */
const toId = (value) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

async function findUserByEmail(email) {
  return toUser(await UserModel.findOne({ where: { email } }));
}

async function findUserById(id) {
  const key = toId(id);
  return key ? toUser(await UserModel.findByPk(key)) : null;
}

async function createUser({ email, name, passwordHash }) {
  return toUser(await UserModel.create({ email, name, passwordHash }));
}

async function updatePassword(userId, passwordHash) {
  await UserModel.update({ passwordHash }, { where: { id: toId(userId) } });
}

async function setUserRole(email, role) {
  const user = await UserModel.findOne({ where: { email } });
  if (!user) return null;
  await user.update({ role });
  return toUser(user);
}

async function createRefreshToken({ userId, tokenHash, familyId, expiresAt }) {
  await RefreshTokenModel.create({ userId: toId(userId), tokenHash, familyId, expiresAt });
}

async function findRefreshToken(tokenHash) {
  return toToken(await RefreshTokenModel.findOne({ where: { tokenHash } }));
}

/** Revoke a token unless it already is; false means another request used it first */
async function revokeIfActive(id) {
  const [count] = await RefreshTokenModel.update(
    { revokedAt: new Date() },
    { where: { id: toId(id), revokedAt: null } }
  );
  return count === 1;
}

async function revokeFamily(familyId) {
  await RefreshTokenModel.update({ revokedAt: new Date() }, { where: { familyId, revokedAt: null } });
}

async function revokeAllForUser(userId) {
  await RefreshTokenModel.update({ revokedAt: new Date() }, { where: { userId: toId(userId), revokedAt: null } });
}

async function deleteExpiredTokens(userId) {
  await RefreshTokenModel.destroy({ where: { userId: toId(userId), expiresAt: { [Op.lt]: new Date() } } });
}

async function markEmailVerified(userId) {
  await UserModel.update({ emailVerifiedAt: new Date() }, { where: { id: toId(userId), emailVerifiedAt: null } });
}

async function createAuthToken(data) {
  await AuthTokenModel.create({ ...data, userId: toId(data.userId) });
}

/**
 * Use a one-time token: marks it used and returns its user's id, or null when the
 * token is unknown, of another type, expired or already used.
 */
async function consumeAuthToken(tokenHash, type) {
  const token = await AuthTokenModel.findOne({ where: { tokenHash, type } });
  if (!token || token.usedAt || token.expiresAt <= new Date()) return null;

  // Only one request can use it, even when two arrive at the same time
  const [count] = await AuthTokenModel.update(
    { usedAt: new Date() },
    { where: { id: token.id, usedAt: null } }
  );
  return count === 1 ? String(token.userId) : null;
}

/** Remove a user's unused tokens of one type, so only the newest link works */
async function deleteAuthTokens(userId, type) {
  await AuthTokenModel.destroy({ where: { userId: toId(userId), type } });
}

module.exports = {
  findUserByEmail,
  findUserById,
  createUser,
  updatePassword,
  setUserRole,
  createRefreshToken,
  findRefreshToken,
  revokeIfActive,
  revokeFamily,
  revokeAllForUser,
  deleteExpiredTokens,
  markEmailVerified,
  createAuthToken,
  consumeAuthToken,
  deleteAuthTokens
};
