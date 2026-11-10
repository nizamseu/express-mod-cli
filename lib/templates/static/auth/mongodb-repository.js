const mongoose = require('mongoose');
const UserModel = require('./user.model');
const RefreshTokenModel = require('./refresh-token.model');
const AuthTokenModel = require('./auth-token.model');

/**
 * Database access for authentication (MongoDB).
 * Returns plain objects, so the controller works the same with every database.
 * The user object includes passwordHash - never send it to clients.
 */

const toUser = (doc) =>
  doc && {
    id: String(doc._id),
    email: doc.email,
    name: doc.name ?? null,
    role: doc.role,
    passwordHash: doc.passwordHash,
    emailVerifiedAt: doc.emailVerifiedAt ?? null,
    createdAt: doc.createdAt
  };

const toToken = (doc) =>
  doc && {
    id: String(doc._id),
    userId: String(doc.userId),
    familyId: doc.familyId,
    expiresAt: doc.expiresAt,
    revokedAt: doc.revokedAt
  };

async function findUserByEmail(email) {
  return toUser(await UserModel.findOne({ email }));
}

async function findUserById(id) {
  return mongoose.isValidObjectId(id) ? toUser(await UserModel.findById(id)) : null;
}

async function createUser({ email, name, passwordHash }) {
  return toUser(await UserModel.create({ email, name, passwordHash }));
}

async function updatePassword(userId, passwordHash) {
  await UserModel.updateOne({ _id: userId }, { passwordHash });
}

async function setUserRole(email, role) {
  return toUser(
    await UserModel.findOneAndUpdate({ email }, { role }, { returnDocument: 'after', runValidators: true })
  );
}

async function createRefreshToken({ userId, tokenHash, familyId, expiresAt }) {
  await RefreshTokenModel.create({ userId, tokenHash, familyId, expiresAt });
}

async function findRefreshToken(tokenHash) {
  return toToken(await RefreshTokenModel.findOne({ tokenHash }));
}

/** Revoke a token unless it already is; false means another request used it first */
async function revokeIfActive(id) {
  const result = await RefreshTokenModel.updateOne({ _id: id, revokedAt: null }, { revokedAt: new Date() });
  return result.modifiedCount === 1;
}

async function revokeFamily(familyId) {
  await RefreshTokenModel.updateMany({ familyId, revokedAt: null }, { revokedAt: new Date() });
}

async function revokeAllForUser(userId) {
  await RefreshTokenModel.updateMany({ userId, revokedAt: null }, { revokedAt: new Date() });
}

async function deleteExpiredTokens(userId) {
  await RefreshTokenModel.deleteMany({ userId, expiresAt: { $lt: new Date() } });
}

async function markEmailVerified(userId) {
  await UserModel.updateOne({ _id: userId, emailVerifiedAt: null }, { emailVerifiedAt: new Date() });
}

async function createAuthToken(data) {
  await AuthTokenModel.create(data);
}

/**
 * Use a one-time token: marks it used and returns its user's id, or null when the
 * token is unknown, of another type, expired or already used.
 */
async function consumeAuthToken(tokenHash, type) {
  const token = await AuthTokenModel.findOneAndUpdate(
    { tokenHash, type, usedAt: null, expiresAt: { $gt: new Date() } },
    { usedAt: new Date() }
  );
  return token ? String(token.userId) : null;
}

/** Remove a user's unused tokens of one type, so only the newest link works */
async function deleteAuthTokens(userId, type) {
  await AuthTokenModel.deleteMany({ userId, type });
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
