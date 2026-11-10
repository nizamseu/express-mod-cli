import type { CookieOptions } from 'express';

/**
 * Authentication settings, read from the environment (.env).
 * They are read when used, so tests can set them before the first request.
 */
const MIN_SECRET_LENGTH = 32;

/** Secret that signs access tokens. Anyone who knows it can create valid tokens. */
export function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`JWT_SECRET must be a random string of at least ${MIN_SECRET_LENGTH} characters - set it in .env`);
  }
  return secret;
}

/** Lifetime of an access token, e.g. "15m", "1h" */
export const accessTokenExpiresIn = (): string => process.env.JWT_ACCESS_EXPIRES_IN || '15m';

/** Lifetime of a refresh token (a login), in days */
export const refreshTokenDays = (): number => Number(process.env.REFRESH_TOKEN_DAYS) || 30;

/** Also send the refresh token in response bodies, for clients that can't use cookies (mobile apps) */
export const refreshTokenInBody = (): boolean => process.env.AUTH_REFRESH_IN_BODY === 'true';

/** Refuse logins until the email address is verified */
export const requireVerifiedEmail = (): boolean => process.env.AUTH_REQUIRE_VERIFIED_EMAIL === 'true';

/** How long the links in emails work */
export const VERIFY_EMAIL_HOURS = 24;
export const RESET_PASSWORD_MINUTES = 60;

/**
 * Links in emails open your frontend, which sends the token to the API
 * (POST /auth/verify-email, POST /auth/reset-password).
 */
const appUrl = (): string => (process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
export const verifyEmailUrl = (): string => process.env.AUTH_VERIFY_EMAIL_URL || `${appUrl()}/verify-email`;
export const resetPasswordUrl = (): string => process.env.AUTH_RESET_PASSWORD_URL || `${appUrl()}/reset-password`;

export const REFRESH_COOKIE = 'refreshToken';

/**
 * The refresh token cookie: JavaScript can't read it, and the browser only sends it to /auth.
 * For a frontend on another site, set AUTH_COOKIE_SAMESITE=none (needs HTTPS) and enable
 * CORS with credentials for that origin.
 */
export function refreshCookieOptions(): CookieOptions {
  const sameSite = (process.env.AUTH_COOKIE_SAMESITE || 'lax') as 'lax' | 'strict' | 'none';

  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' || sameSite === 'none',
    sameSite,
    path: '/auth',
  };
}
