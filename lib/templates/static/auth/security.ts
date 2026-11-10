import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';
import { accessTokenExpiresIn, jwtSecret } from '../config/auth';

/** The user an access token belongs to (set as req.user by requireAuth) */
export interface AuthUser {
  id: string;
  role: string;
}

const BCRYPT_ROUNDS = 12;
let dummyHash: string | undefined;

/** Hash a password for storage */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Check a password against a stored hash.
 * Without a hash (no account with that email) a dummy hash is checked anyway,
 * so the response time doesn't reveal whether the account exists.
 */
export async function verifyPassword(password: string, hash: string | undefined): Promise<boolean> {
  if (!hash) {
    dummyHash ??= await bcrypt.hash('not-a-real-password', BCRYPT_ROUNDS);
    await bcrypt.compare(password, dummyHash);
    return false;
  }
  return bcrypt.compare(password, hash);
}

/** Create a short-lived access token for a user; expiresIn is in seconds */
export function signAccessToken(user: AuthUser): { accessToken: string; expiresIn: number } {
  const accessToken = jwt.sign({ role: user.role }, jwtSecret(), {
    subject: String(user.id),
    expiresIn: accessTokenExpiresIn() as SignOptions['expiresIn'],
    algorithm: 'HS256',
  });
  const { exp = 0, iat = 0 } = jwt.decode(accessToken) as JwtPayload;
  return { accessToken, expiresIn: exp - iat };
}

/** Read the user from an access token. Throws a jsonwebtoken error when it is invalid or expired. */
export function verifyAccessToken(token: string): AuthUser {
  const payload = jwt.verify(token, jwtSecret(), { algorithms: ['HS256'] });
  if (typeof payload === 'string' || !payload.sub) {
    throw new jwt.JsonWebTokenError('Unexpected token payload');
  }
  return { id: payload.sub, role: String(payload.role) };
}

/** A random, URL-safe token (refresh tokens) */
export const generateToken = (): string => crypto.randomBytes(32).toString('base64url');

/** Tokens are stored as hashes, so a database leak doesn't expose usable tokens */
export const hashToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');
