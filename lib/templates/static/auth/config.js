/**
 * Authentication settings, read from the environment (.env).
 * They are read when used, so tests can set them before the first request.
 */
const MIN_SECRET_LENGTH = 32;

/** Secret that signs access tokens. Anyone who knows it can create valid tokens. */
function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`JWT_SECRET must be a random string of at least ${MIN_SECRET_LENGTH} characters - set it in .env`);
  }
  return secret;
}

/** Lifetime of an access token, e.g. "15m", "1h" */
const accessTokenExpiresIn = () => process.env.JWT_ACCESS_EXPIRES_IN || '15m';

/** Lifetime of a refresh token (a login), in days */
const refreshTokenDays = () => Number(process.env.REFRESH_TOKEN_DAYS) || 30;

/** Also send the refresh token in response bodies, for clients that can't use cookies (mobile apps) */
const refreshTokenInBody = () => process.env.AUTH_REFRESH_IN_BODY === 'true';

/** Refuse logins until the email address is verified */
const requireVerifiedEmail = () => process.env.AUTH_REQUIRE_VERIFIED_EMAIL === 'true';

/** How long the links in emails work */
const VERIFY_EMAIL_HOURS = 24;
const RESET_PASSWORD_MINUTES = 60;

/**
 * Links in emails open your frontend, which sends the token to the API
 * (POST /auth/verify-email, POST /auth/reset-password).
 */
const appUrl = () => (process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
const verifyEmailUrl = () => process.env.AUTH_VERIFY_EMAIL_URL || `${appUrl()}/verify-email`;
const resetPasswordUrl = () => process.env.AUTH_RESET_PASSWORD_URL || `${appUrl()}/reset-password`;

const REFRESH_COOKIE = 'refreshToken';

/**
 * The refresh token cookie: JavaScript can't read it, and the browser only sends it to /auth.
 * For a frontend on another site, set AUTH_COOKIE_SAMESITE=none (needs HTTPS) and enable
 * CORS with credentials for that origin.
 */
function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' || process.env.AUTH_COOKIE_SAMESITE === 'none',
    sameSite: process.env.AUTH_COOKIE_SAMESITE || 'lax',
    path: '/auth',
  };
}

module.exports = {
  jwtSecret,
  accessTokenExpiresIn,
  refreshTokenDays,
  refreshTokenInBody,
  requireVerifiedEmail,
  VERIFY_EMAIL_HOURS,
  RESET_PASSWORD_MINUTES,
  verifyEmailUrl,
  resetPasswordUrl,
  REFRESH_COOKIE,
  refreshCookieOptions,
};
