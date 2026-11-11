import express from 'express';
import { rateLimit } from 'express-rate-limit';
import * as repository from '../modules/auth/auth.repository';
import { registerSchema } from '../modules/auth/auth.validation';
import { resetPasswordMessage } from '../modules/auth/auth.emails';
import { sendMailInBackground } from '../utils/mailer';
import { hashPassword, generateToken, hashToken } from '../utils/security';
import { RESET_PASSWORD_MINUTES } from '../config/auth';
import config from './admin.config';
import { panelRoles } from './authenticate';

/**
 * "Forgot your password?" for the admin panel:
 *   GET/POST <panel>/forgot-password  - email a link (only to admins and staff)
 *   GET/POST <panel>/reset-password   - choose a new password with the link's token
 * It uses the same one-time tokens and email as POST /auth/forgot-password.
 */

const escapeHtml = (text: unknown): string =>
  String(text).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[char]);

/** A small page in the panel's colours */
const page = (title: string, body: string, dark = false): string => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} - ${escapeHtml(config.title)}</title>
<style>
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    background: #f6f7fb; font-family: Roboto, system-ui, sans-serif; color: #0c1e29; }
  main { background: #fff; width: 100%; max-width: 420px; padding: 40px; box-shadow: 0 15px 24px 0 rgba(137,138,154,.15); }
  h1 { font-size: 22px; font-weight: 400; margin: 0 0 8px; }
  p { color: #454655; line-height: 1.5; }
  label { display: block; font-size: 12px; margin: 20px 0 6px; }
  input { width: 100%; box-sizing: border-box; padding: 10px; border: 1px solid #c0c0ca; font-size: 14px; }
  button { margin-top: 24px; width: 100%; padding: 11px; border: 0; background: #3040d6; color: #fff; font-size: 14px; cursor: pointer; }
  .error { background: #fbe2e2; color: #c20012; padding: 10px 12px; }
  .ok { background: #e2f7ed; color: #007d48; padding: 10px 12px; }
  a { color: #3040d6; }
  body.dark { background: #151419; color: #fff; }
  body.dark main { background: #1a1a1e; box-shadow: 0 15px 24px 0 rgba(0,0,0,.3); }
  body.dark p, body.dark label { color: #cdcbd4; }
  body.dark input { background: #151419; color: #fff; border-color: #39383d; }
  body.dark a { color: #8cb4ff; }
</style>
</head>
<body${dark ? ' class="dark"' : ''}><main><h1>${escapeHtml(title)}</h1>${body}</main></body>
</html>`;

/** The user picked the dark theme in the panel (see theme.ts) */
const isDark = (req: express.Request): boolean => /(?:^|;\s*)admin_theme=dark(?:;|$)/.test(req.headers.cookie || '');

const backToLogin = `<p><a href="${config.path}/login">Back to the login page</a></p>`;

const forgotForm = (message = '', dark = false): string =>
  page(
    'Forgot your password?',
    `${message}<p>Enter the email address of your admin account and we'll send you a link to choose a new password.</p>
<form method="POST">
  <label for="email">Email</label>
  <input id="email" name="email" type="email" autocomplete="username" required>
  <button type="submit">Send the link</button>
</form>${backToLogin}`,
    dark
  );

const resetForm = (token: string, message = '', dark = false): string =>
  page(
    'Choose a new password',
    `${message}<form method="POST">
  <input type="hidden" name="token" value="${escapeHtml(token)}">
  <label for="password">New password (at least 8 characters)</label>
  <input id="password" name="password" type="password" autocomplete="new-password" required minlength="8">
  <label for="confirm">Repeat the new password</label>
  <input id="confirm" name="confirm" type="password" autocomplete="new-password" required minlength="8">
  <button type="submit">Save the new password</button>
</form>${backToLogin}`,
    dark
  );

const error = (text: string): string => `<p class="error">${escapeHtml(text)}</p>`;

const limit = (max: number) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: max,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (req, res) => res.status(429).send(page('Too many attempts', `<p>Please try again later.</p>${backToLogin}`, isDark(req))),
  });

const router = express.Router();
const form = express.urlencoded({ extended: false, limit: '10kb' });

router.get('/forgot-password', (req, res) => {
  res.send(forgotForm('', isDark(req)));
});

router.post('/forgot-password', limit(Number(process.env.AUTH_EMAIL_RATE_LIMIT) || 5), form, async (req, res, next) => {
  try {
    const email = registerSchema.shape.email.safeParse(req.body.email);
    if (!email.success) {
      res.status(400).send(forgotForm(error('Enter a valid email address'), isDark(req)));
      return;
    }

    const user = await repository.findUserByEmail(email.data);
    // Only panel users get a link; the answer is the same either way
    if (user && panelRoles().includes(user.role)) {
      const token = generateToken();
      await repository.deleteAuthTokens(user.id, 'reset-password');
      await repository.createAuthToken({
        userId: user.id,
        type: 'reset-password',
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + RESET_PASSWORD_MINUTES * 60 * 1000),
      });
      sendMailInBackground(
        resetPasswordMessage(user, `${config.url}${config.path}/reset-password?token=${encodeURIComponent(token)}`)
      );
    }

    res.send(
      page(
        'Check your email',
        `<p class="ok">If an admin account uses ${escapeHtml(email.data)}, we sent it a link to choose a new password.</p>
<p>The link works for ${RESET_PASSWORD_MINUTES} minutes.</p>${backToLogin}`,
        isDark(req)
      )
    );
  } catch (err) {
    next(err);
  }
});

router.get('/reset-password', (req, res) => {
  const token = typeof req.query.token === 'string' ? req.query.token : '';
  res.send(token ? resetForm(token, '', isDark(req)) : forgotForm(error('This reset link is incomplete - ask for a new one.'), isDark(req)));
});

router.post('/reset-password', limit(Number(process.env.AUTH_RATE_LIMIT) || 20), form, async (req, res, next) => {
  try {
    const token = typeof req.body.token === 'string' ? req.body.token : '';
    const password = registerSchema.shape.password.safeParse(req.body.password);

    if (!password.success) {
      res.status(400).send(resetForm(token, error(password.error.issues[0].message), isDark(req)));
      return;
    }
    if (req.body.password !== req.body.confirm) {
      res.status(400).send(resetForm(token, error('The two passwords are different'), isDark(req)));
      return;
    }

    const userId = token && (await repository.consumeAuthToken(hashToken(token), 'reset-password'));
    const user = userId && (await repository.findUserById(userId));
    if (!user) {
      res.status(400).send(forgotForm(error('This reset link is invalid or has expired - ask for a new one.'), isDark(req)));
      return;
    }

    await repository.updatePassword(user.id, await hashPassword(password.data));
    await repository.deleteAuthTokens(user.id, 'reset-password');
    // Ends every login, in the API and (with the new password) in the panel
    await repository.revokeAllForUser(user.id);
    await repository.markEmailVerified(user.id);

    res.redirect(`${config.path}/login?notice=password-reset`);
  } catch (err) {
    next(err);
  }
});

export default router;
