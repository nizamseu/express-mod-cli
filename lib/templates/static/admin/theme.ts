import express, { type Request } from 'express';
import config from './admin.config';

/**
 * The theme switcher in the user menu (top bar):
 *   GET <panel>/theme?id=dark&back=<page>
 * The choice is kept in the login session (AdminJS reads it from there) and in a
 * cookie, so it is still there after logging out and in again.
 */
const THEMES = ['light', 'dark', 'noSidebar'];
const THEME_COOKIE = 'admin_theme';
const YEAR = 365 * 24 * 60 * 60 * 1000;

type AdminSession = { adminUser?: { theme?: string } };
const sessionOf = (req: Request) => req.session as unknown as AdminSession | undefined;

const savedTheme = (req: Request): string | undefined => {
  const match = (req.headers.cookie || '').match(new RegExp(`(?:^|;\\s*)${THEME_COOKIE}=([^;]+)`));
  return match && THEMES.includes(match[1]) ? match[1] : undefined;
};

const router = express.Router();

// A user who logs in gets the theme they chose before
router.use((req, _res, next) => {
  const adminUser = sessionOf(req)?.adminUser;
  const theme = savedTheme(req);
  if (adminUser && theme && adminUser.theme !== theme) {
    adminUser.theme = theme;
  }
  next();
});

router.get('/theme', (req, res) => {
  const id = String(req.query.id || '');
  const back = typeof req.query.back === 'string' ? req.query.back : '';
  // Only pages of the panel, never another site
  const target = back.startsWith(`${config.path}/`) && !back.startsWith('//') ? back : config.path;

  if (THEMES.includes(id)) {
    // Not httpOnly: it's only a colour choice, and the login page reads it to match
    res.cookie(THEME_COOKIE, id, { sameSite: 'lax', path: config.path, maxAge: YEAR });
    const adminUser = sessionOf(req)?.adminUser;
    if (adminUser) adminUser.theme = id;
  }
  res.redirect(target);
});

export default router;
