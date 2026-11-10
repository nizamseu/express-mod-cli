import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import * as repository from './auth.repository';
import type { AuthTokenType, StoredUser } from './auth.repository';
import { resetPasswordMessage, verifyEmailMessage } from './auth.emails';
import type {
  ChangePasswordInput,
  EmailInput,
  LoginInput,
  RefreshInput,
  RegisterInput,
  ResetPasswordInput,
  VerifyEmailInput
} from './auth.validation';
import { sendMailInBackground } from '../../utils/mailer';
import {
  hashPassword,
  verifyPassword,
  signAccessToken,
  generateToken,
  hashToken
} from '../../utils/security';
import {
  jwtSecret,
  REFRESH_COOKIE,
  refreshCookieOptions,
  refreshTokenDays,
  refreshTokenInBody,
  requireVerifiedEmail,
  VERIFY_EMAIL_HOURS,
  RESET_PASSWORD_MINUTES,
  verifyEmailUrl,
  resetPasswordUrl
} from '../../config/auth';

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

/** What clients see of a user - never the password hash */
const publicUser = ({ id, email, name, role, emailVerifiedAt, createdAt }: StoredUser) => ({
  id,
  email,
  name,
  role,
  emailVerified: Boolean(emailVerifiedAt),
  createdAt
});

function fail(res: Response, status: number, message: string, code?: string): void {
  res.status(status).json({ success: false, message, ...(code ? { code } : {}) });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, refreshCookieOptions());
}

/**
 * Give the user a new access token and refresh token.
 * Every login starts a token "family"; refreshing keeps the family, so a stolen
 * refresh token that is used twice can end that whole login (see refresh()).
 */
async function issueTokens(res: Response, user: StoredUser, familyId: string = crypto.randomUUID()) {
  const access = signAccessToken(user); // first: fails before anything is stored if JWT_SECRET is missing
  const refreshToken = generateToken();
  const days = refreshTokenDays();

  await repository.deleteExpiredTokens(user.id);
  await repository.createRefreshToken({
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    familyId,
    expiresAt: new Date(Date.now() + days * DAY)
  });

  res.cookie(REFRESH_COOKIE, refreshToken, { ...refreshCookieOptions(), maxAge: days * DAY });

  return {
    ...access,
    ...(refreshTokenInBody() ? { refreshToken } : {})
  };
}

const readRefreshToken = (req: Request): string | undefined =>
  req.cookies?.[REFRESH_COOKIE] || (req.body as RefreshInput | undefined)?.refreshToken;

/**
 * Create a one-time token for a user (older unused ones of that type stop working)
 * and email the link that contains it.
 */
async function sendTokenEmail(user: StoredUser, type: AuthTokenType): Promise<void> {
  const token = generateToken();
  const lifetime = type === 'verify-email' ? VERIFY_EMAIL_HOURS * 60 * MINUTE : RESET_PASSWORD_MINUTES * MINUTE;

  await repository.deleteAuthTokens(user.id, type);
  await repository.createAuthToken({
    userId: user.id,
    type,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + lifetime)
  });

  const query = `?token=${encodeURIComponent(token)}`;
  sendMailInBackground(
    type === 'verify-email'
      ? verifyEmailMessage(user, verifyEmailUrl() + query)
      : resetPasswordMessage(user, resetPasswordUrl() + query)
  );
}

/**
 * POST /auth/register - create an account, email a verification link and log in
 * (with AUTH_REQUIRE_VERIFIED_EMAIL=true the user logs in after verifying)
 */
export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    jwtSecret(); // fail before creating the account if JWT_SECRET is missing
    const { email, password, name } = req.body as RegisterInput;

    if (await repository.findUserByEmail(email)) {
      fail(res, 409, 'An account with this email already exists');
      return;
    }

    const user = await repository.createUser({ email, name, passwordHash: await hashPassword(password) });
    await sendTokenEmail(user, 'verify-email');

    if (requireVerifiedEmail()) {
      res.status(201).json({
        success: true,
        data: { user: publicUser(user) },
        message: 'Account created - open the link in the email we sent to verify your address'
      });
      return;
    }

    const tokens = await issueTokens(res, user);

    res.status(201).json({
      success: true,
      data: { user: publicUser(user), ...tokens },
      message: 'Account created successfully'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /auth/login
 */
export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body as LoginInput;
    const user = await repository.findUserByEmail(email);

    // The same message for an unknown email and a wrong password
    if (!(await verifyPassword(password, user?.passwordHash)) || !user) {
      fail(res, 401, 'Invalid email or password');
      return;
    }

    if (requireVerifiedEmail() && !user.emailVerifiedAt) {
      fail(res, 403, 'Verify your email address before logging in', 'EMAIL_NOT_VERIFIED');
      return;
    }

    const tokens = await issueTokens(res, user);

    res.json({
      success: true,
      data: { user: publicUser(user), ...tokens },
      message: 'Logged in successfully'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /auth/refresh - trade a refresh token for new tokens (the old one stops working)
 */
export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = readRefreshToken(req);
    if (!token) {
      fail(res, 401, 'Refresh token required');
      return;
    }

    const record = await repository.findRefreshToken(hashToken(token));
    if (!record || record.expiresAt < new Date()) {
      clearRefreshCookie(res);
      fail(res, 401, 'Invalid or expired refresh token');
      return;
    }

    // A token that was already used came back: someone may have copied it.
    // End the whole login, so neither copy works any more.
    if (record.revokedAt || !(await repository.revokeIfActive(record.id))) {
      await repository.revokeFamily(record.familyId);
      clearRefreshCookie(res);
      fail(res, 401, 'Refresh token was already used - please log in again');
      return;
    }

    const user = await repository.findUserById(record.userId);
    if (!user) {
      clearRefreshCookie(res);
      fail(res, 401, 'Invalid or expired refresh token');
      return;
    }

    const tokens = await issueTokens(res, user, record.familyId);

    res.json({
      success: true,
      data: { user: publicUser(user), ...tokens },
      message: 'Token refreshed successfully'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /auth/logout - end this login
 */
export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = readRefreshToken(req);
    if (token) {
      const record = await repository.findRefreshToken(hashToken(token));
      if (record) await repository.revokeFamily(record.familyId);
    }

    clearRefreshCookie(res);
    res.json({ success: true, data: null, message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /auth/logout-all - end every login of the current user
 */
export async function logoutAll(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await repository.revokeAllForUser(req.user!.id);

    clearRefreshCookie(res);
    res.json({ success: true, data: null, message: 'Logged out from all devices' });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /auth/me - the current user
 */
export async function me(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await repository.findUserById(req.user!.id);
    if (!user) {
      fail(res, 404, 'User not found');
      return;
    }

    res.json({ success: true, data: publicUser(user), message: 'User retrieved successfully' });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /auth/change-password - also ends every other login
 */
export async function changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { currentPassword, newPassword } = req.body as ChangePasswordInput;
    const user = await repository.findUserById(req.user!.id);
    if (!user) {
      fail(res, 404, 'User not found');
      return;
    }

    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      fail(res, 400, 'Current password is incorrect');
      return;
    }

    await repository.updatePassword(user.id, await hashPassword(newPassword));
    await repository.revokeAllForUser(user.id);
    const tokens = await issueTokens(res, user);

    res.json({ success: true, data: tokens, message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /auth/verify-email - the token from the verification email
 */
export async function verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = await repository.consumeAuthToken(hashToken((req.body as VerifyEmailInput).token), 'verify-email');
    if (!userId) {
      fail(res, 400, 'This verification link is invalid or has expired', 'INVALID_TOKEN');
      return;
    }

    await repository.markEmailVerified(userId);
    await repository.deleteAuthTokens(userId, 'verify-email');
    res.json({ success: true, data: null, message: 'Email address verified successfully' });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /auth/resend-verification - a new verification email.
 * The answer is the same whether or not the account exists.
 */
export async function resendVerification(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await repository.findUserByEmail((req.body as EmailInput).email);
    if (user && !user.emailVerifiedAt) {
      await sendTokenEmail(user, 'verify-email');
    }

    res.json({
      success: true,
      data: null,
      message: 'If an unverified account uses this email, we sent it a new verification link'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /auth/forgot-password - email a link to choose a new password.
 * The answer is the same whether or not the account exists.
 */
export async function forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await repository.findUserByEmail((req.body as EmailInput).email);
    if (user) {
      await sendTokenEmail(user, 'reset-password');
    }

    res.json({
      success: true,
      data: null,
      message: 'If an account uses this email, we sent it a link to reset the password'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /auth/reset-password - the token from the email and a new password.
 * Ends every login; the user then logs in with the new password.
 */
export async function resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { token, newPassword } = req.body as ResetPasswordInput;
    const userId = await repository.consumeAuthToken(hashToken(token), 'reset-password');
    const user = userId && (await repository.findUserById(userId));
    if (!user) {
      fail(res, 400, 'This reset link is invalid or has expired', 'INVALID_TOKEN');
      return;
    }

    await repository.updatePassword(user.id, await hashPassword(newPassword));
    await repository.deleteAuthTokens(user.id, 'reset-password');
    await repository.revokeAllForUser(user.id);
    // Opening the emailed link proves the address works
    await repository.markEmailVerified(user.id);

    res.json({ success: true, data: null, message: 'Password reset successfully - log in with the new password' });
  } catch (error) {
    next(error);
  }
}

