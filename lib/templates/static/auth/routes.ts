import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import validate from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import * as authController from './auth.controller';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  changePasswordSchema,
  verifyEmailSchema,
  emailSchema,
  resetPasswordSchema
} from './auth.validation';

const router = Router();

// Requests per IP per 15 minutes, counted for each route on its own.
// Behind a proxy (Nginx, Heroku, ...) add app.set('trust proxy', 1) so the client's IP is used.
const limit = (max: number) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: max,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { success: false, message: 'Too many attempts, please try again later' }
  });

// Slows down password guessing (AUTH_RATE_LIMIT, default 20)
const attempts = () => limit(Number(process.env.AUTH_RATE_LIMIT) || 20);
// Limits how many emails one client can trigger (AUTH_EMAIL_RATE_LIMIT, default 5)
const emails = () => limit(Number(process.env.AUTH_EMAIL_RATE_LIMIT) || 5);

router.post('/register', attempts(), validate(registerSchema), authController.register);
router.post('/login', attempts(), validate(loginSchema), authController.login);
router.post('/refresh', validate(refreshSchema), authController.refresh);
router.post('/logout', validate(refreshSchema), authController.logout);
router.post('/logout-all', requireAuth, authController.logoutAll);
router.get('/me', requireAuth, authController.me);
router.post('/change-password', requireAuth, attempts(), validate(changePasswordSchema), authController.changePassword);

// Email verification and password reset
router.post('/verify-email', attempts(), validate(verifyEmailSchema), authController.verifyEmail);
router.post('/resend-verification', emails(), validate(emailSchema), authController.resendVerification);
router.post('/forgot-password', emails(), validate(emailSchema), authController.forgotPassword);
router.post('/reset-password', attempts(), validate(resetPasswordSchema), authController.resetPassword);

export default router;
