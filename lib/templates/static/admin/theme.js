const express = require('express');
const config = require('./admin.config');
const { THEME_IDS } = require('./themes');

/**
 * The theme switcher in the user menu (top bar):
 *   GET <panel>/theme?id=dark&back=<page>
 * The choice is kept in the login session (AdminJS reads it from there) and in a
 * cookie, so it is still there after logging out and in again.
 */
const THEMES = THEME_IDS;
const THEME_COOKIE = 'admin_theme';
const YEAR = 365 * 24 * 60 * 60 * 1000;

const savedTheme = (req) => {
  const match = (req.headers.cookie || '').match(new RegExp(`(?:^|;\\s*)${THEME_COOKIE}=([^;]+)`));
  return match && THEMES.includes(match[1]) ? match[1] : undefined;
};

const router = express.Router();

// A user who logs in gets the theme they chose before. A theme that no longer exists
// (renamed or removed) is dropped: AdminJS would otherwise show no theme menu at all.
router.use((req, res, next) => {
  const adminUser = req.session?.adminUser;
  const theme = savedTheme(req);

  if (!theme && /(?:^|;\s*)admin_theme=/.test(req.headers.cookie || '')) {
    res.clearCookie(THEME_COOKIE, { path: config.path });
  }
  if (adminUser && adminUser.theme !== theme && (theme || adminUser.theme)) {
    if (theme) adminUser.theme = theme;
    else if (!THEMES.includes(adminUser.theme)) delete adminUser.theme;
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
    if (req.session?.adminUser) req.session.adminUser.theme = id;
  }
  res.redirect(target);
});

module.exports = router;
