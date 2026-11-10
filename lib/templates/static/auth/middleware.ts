import type { RequestHandler } from 'express';
import { verifyAccessToken, type AuthUser } from '../utils/security';

declare global {
  namespace Express {
    interface Request {
      /** The logged-in user, set by requireAuth */
      user?: AuthUser;
    }
  }
}

const TOKEN_ERRORS = ['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'];

/**
 * Only lets requests with a valid access token through
 * ("Authorization: Bearer <token>") and sets req.user = { id, role }.
 */
export const requireAuth: RequestHandler = (req, res, next) => {
  const [scheme, token] = (req.headers.authorization || '').split(' ');

  if (scheme !== 'Bearer' || !token) {
    res.status(401).json({ success: false, message: 'Authentication required' });
    return;
  }

  try {
    req.user = verifyAccessToken(token);
  } catch (error) {
    if (error instanceof Error && TOKEN_ERRORS.includes(error.name)) {
      res.status(401).json({ success: false, message: 'Invalid or expired token' });
      return;
    }
    next(error); // e.g. JWT_SECRET is not set
    return;
  }

  next();
};

/**
 * Like requireAuth, and the user must have one of the given roles:
 *   router.delete('/:id', requireRole('admin'), controller.remove);
 */
export const requireRole = (...roles: string[]): RequestHandler => (req, res, next) => {
  requireAuth(req, res, (error?: unknown) => {
    if (error) {
      next(error);
      return;
    }
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ success: false, message: 'You do not have permission to do this' });
      return;
    }
    next();
  });
};
