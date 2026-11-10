const { verifyAccessToken } = require('../utils/security');

const TOKEN_ERRORS = ['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'];

/**
 * Only lets requests with a valid access token through
 * ("Authorization: Bearer <token>") and sets req.user = { id, role }.
 */
function requireAuth(req, res, next) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');

  if (scheme !== 'Bearer' || !token) {
    res.status(401).json({ success: false, message: 'Authentication required' });
    return;
  }

  try {
    req.user = verifyAccessToken(token);
  } catch (error) {
    if (TOKEN_ERRORS.includes(error.name)) {
      res.status(401).json({ success: false, message: 'Invalid or expired token' });
      return;
    }
    next(error); // e.g. JWT_SECRET is not set
    return;
  }

  next();
}

/**
 * Like requireAuth, and the user must have one of the given roles:
 *   router.delete('/:id', requireRole('admin'), controller.remove);
 */
const requireRole = (...roles) => (req, res, next) => {
  requireAuth(req, res, (error) => {
    if (error) {
      next(error);
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ success: false, message: 'You do not have permission to do this' });
      return;
    }
    next();
  });
};

module.exports = { requireAuth, requireRole };
