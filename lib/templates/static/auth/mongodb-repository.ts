import mongoose from 'mongoose';
import UserModel, { type UserDocument } from './user.model';
import RefreshTokenModel, { type RefreshTokenDocument } from './refresh-token.model';
import AuthTokenModel from './auth-token.model';

/**
 * Database access for authentication (MongoDB).
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

type WithId<T> = T & { _id: unknown };

const toUser = (doc: WithId<UserDocument> | null): StoredUser | null =>
  doc && {
    id: String(doc._id),
    email: doc.email,
    name: doc.name ?? null,
    role: doc.role ?? 'user',
    passwordHash: doc.passwordHash,
    emailVerifiedAt: doc.emailVerifiedAt ?? null,
    createdAt: doc.createdAt
  };

const toToken = (doc: WithId<RefreshTokenDocument> | null): StoredRefreshToken | null =>
  doc && {
    id: String(doc._id),
    userId: String(doc.userId),
    familyId: doc.familyId,
    expiresAt: doc.expiresAt,
    revokedAt: doc.revokedAt ?? null
  };

export async function findUserByEmail(email: string): Promise<StoredUser | null> {
  return toUser(await UserModel.findOne({ email }));
}

export async function findUserById(id: string): Promise<StoredUser | null> {
  return mongoose.isValidObjectId(id) ? toUser(await UserModel.findById(id)) : null;
}

export async function createUser(data: { email: string; name?: string; passwordHash: string }): Promise<StoredUser> {
  return toUser(await UserModel.create(data)) as StoredUser;
}

export async function updatePassword(userId: string, passwordHash: string): Promise<void> {
  await UserModel.updateOne({ _id: userId }, { passwordHash });
}

export async function setUserRole(email: string, role: string): Promise<StoredUser | null> {
  return toUser(
    await UserModel.findOneAndUpdate({ email }, { role }, { returnDocument: 'after', runValidators: true })
  );
}

export async function createRefreshToken(data: {
  userId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
}): Promise<void> {
  await RefreshTokenModel.create(data);
}

export async function findRefreshToken(tokenHash: string): Promise<StoredRefreshToken | null> {
  return toToken(await RefreshTokenModel.findOne({ tokenHash }));
}

/** Revoke a token unless it already is; false means another request used it first */
export async function revokeIfActive(id: string): Promise<boolean> {
  const result = await RefreshTokenModel.updateOne({ _id: id, revokedAt: null }, { revokedAt: new Date() });
  return result.modifiedCount === 1;
}

export async function revokeFamily(familyId: string): Promise<void> {
  await RefreshTokenModel.updateMany({ familyId, revokedAt: null }, { revokedAt: new Date() });
}

export async function revokeAllForUser(userId: string): Promise<void> {
  await RefreshTokenModel.updateMany({ userId, revokedAt: null }, { revokedAt: new Date() });
}

export async function deleteExpiredTokens(userId: string): Promise<void> {
  await RefreshTokenModel.deleteMany({ userId, expiresAt: { $lt: new Date() } });
}

export async function markEmailVerified(userId: string): Promise<void> {
  await UserModel.updateOne({ _id: userId, emailVerifiedAt: null }, { emailVerifiedAt: new Date() });
}

export async function createAuthToken(data: { userId: string; type: AuthTokenType; tokenHash: string; expiresAt: Date }): Promise<void> {
  await AuthTokenModel.create(data);
}

/**
 * Use a one-time token: marks it used and returns its user's id, or null when the
 * token is unknown, of another type, expired or already used.
 */
export async function consumeAuthToken(tokenHash: string, type: AuthTokenType): Promise<string | null> {
  const token = await AuthTokenModel.findOneAndUpdate(
    { tokenHash, type, usedAt: null, expiresAt: { $gt: new Date() } },
    { usedAt: new Date() }
  );
  return token ? String(token.userId) : null;
}

/** Remove a user's unused tokens of one type, so only the newest link works */
export async function deleteAuthTokens(userId: string, type: AuthTokenType): Promise<void> {
  await AuthTokenModel.deleteMany({ userId, type });
}
