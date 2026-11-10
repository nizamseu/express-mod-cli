import { Op } from 'sequelize';
import UserModel from './user.model';
import RefreshTokenModel from './refresh-token.model';
import AuthTokenModel from './auth-token.model';

/**
 * Database access for authentication (PostgreSQL / MySQL).
 * Returns plain objects, so the controller works the same with every database.
 */

/** A user as the controller sees it. Includes passwordHash - never send it to clients. */
export interface StoredUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  passwordHash: string;
  emailVerifiedAt: Date | null;
  createdAt: Date;
}

/** Kinds of one-time tokens sent by email */
export type AuthTokenType = 'verify-email' | 'reset-password';

export interface StoredRefreshToken {
  id: string;
  userId: string;
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

const toUser = (row: UserModel | null): StoredUser | null =>
  row && {
    id: String(row.id),
    email: row.email,
    name: row.name ?? null,
    role: row.role,
    passwordHash: row.passwordHash,
    emailVerifiedAt: row.emailVerifiedAt ?? null,
    createdAt: row.createdAt
  };

const toToken = (row: RefreshTokenModel | null): StoredRefreshToken | null =>
  row && {
    id: String(row.id),
    userId: String(row.userId),
    familyId: row.familyId,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt ?? null
  };

/** Ids are auto-increment integers - anything else cannot match a row (0 never exists) */
const toId = (value: string): number => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : 0;
};

export async function findUserByEmail(email: string): Promise<StoredUser | null> {
  return toUser(await UserModel.findOne({ where: { email } }));
}

export async function findUserById(id: string): Promise<StoredUser | null> {
  const key = toId(id);
  return key ? toUser(await UserModel.findByPk(key)) : null;
}

export async function createUser(data: { email: string; name?: string; passwordHash: string }): Promise<StoredUser> {
  return toUser(await UserModel.create(data)) as StoredUser;
}

export async function updatePassword(userId: string, passwordHash: string): Promise<void> {
  await UserModel.update({ passwordHash }, { where: { id: toId(userId) } });
}

export async function setUserRole(email: string, role: string): Promise<StoredUser | null> {
  const user = await UserModel.findOne({ where: { email } });
  if (!user) return null;
  await user.update({ role });
  return toUser(user);
}

export async function createRefreshToken(data: {
  userId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
}): Promise<void> {
  await RefreshTokenModel.create({ ...data, userId: toId(data.userId) });
}

export async function findRefreshToken(tokenHash: string): Promise<StoredRefreshToken | null> {
  return toToken(await RefreshTokenModel.findOne({ where: { tokenHash } }));
}

/** Revoke a token unless it already is; false means another request used it first */
export async function revokeIfActive(id: string): Promise<boolean> {
  const [count] = await RefreshTokenModel.update(
    { revokedAt: new Date() },
    { where: { id: toId(id), revokedAt: null } }
  );
  return count === 1;
}

export async function revokeFamily(familyId: string): Promise<void> {
  await RefreshTokenModel.update({ revokedAt: new Date() }, { where: { familyId, revokedAt: null } });
}

export async function revokeAllForUser(userId: string): Promise<void> {
  await RefreshTokenModel.update({ revokedAt: new Date() }, { where: { userId: toId(userId), revokedAt: null } });
}

export async function deleteExpiredTokens(userId: string): Promise<void> {
  await RefreshTokenModel.destroy({ where: { userId: toId(userId), expiresAt: { [Op.lt]: new Date() } } });
}

export async function markEmailVerified(userId: string): Promise<void> {
  await UserModel.update({ emailVerifiedAt: new Date() }, { where: { id: toId(userId), emailVerifiedAt: null } });
}

export async function createAuthToken(data: { userId: string; type: AuthTokenType; tokenHash: string; expiresAt: Date }): Promise<void> {
  await AuthTokenModel.create({ ...data, userId: toId(data.userId) });
}

/**
 * Use a one-time token: marks it used and returns its user's id, or null when the
 * token is unknown, of another type, expired or already used.
 */
export async function consumeAuthToken(tokenHash: string, type: AuthTokenType): Promise<string | null> {
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
export async function deleteAuthTokens(userId: string, type: AuthTokenType): Promise<void> {
  await AuthTokenModel.destroy({ where: { userId: toId(userId), type } });
}
