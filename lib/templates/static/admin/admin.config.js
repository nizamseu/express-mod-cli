/**
 * Admin panel settings (express-mod-cli add-admin).
 * Values that differ per environment come from .env.
 */
const MIN_SECRET_LENGTH = 32;

const config = {
  // Web path of the panel. src/app mounts the admin router at the same path - change both together.
  path: '__ADMIN_PATH__',
  // Users with this role can do everything (it must be one of the roles in the User model)
  role: '__ADMIN_ROLE__',
  // Users with this role can view, add and edit records of the modules, but not delete them,
  // import, or see the users and the admin log
  staffRole: 'staff',
  // The connection that stores the users - admin login sessions are kept there too
  connection: '__AUTH_CONNECTION__',
  title: process.env.ADMIN_TITLE || 'express-mod-cli admin',
  // Address of this server, for the links in password reset emails
  url: (process.env.ADMIN_URL || `http://localhost:${process.env.PORT || 5000}`).replace(/\/+$/, ''),
  // URL or path of a logo image; without one the title is shown
  logo: process.env.ADMIN_LOGO || false,
  favicon: process.env.ADMIN_FAVICON || undefined,
  // The theme until a user picks one in the user menu (top bar): light, dark or noSidebar
  theme: process.env.ADMIN_THEME || '__ADMIN_THEME__',
  // en or bn
  language: process.env.ADMIN_LANGUAGE || 'en',
  // How long a login lasts
  sessionHours: Number(process.env.ADMIN_SESSION_HOURS) || 8,
  // Failed logins allowed per IP address per 15 minutes
  loginAttempts: Number(process.env.AUTH_RATE_LIMIT) || 20,
  // Largest file the panel accepts for file and image fields
  uploadMaxMb: Number(process.env.ADMIN_UPLOAD_MAX_MB) || 10,
};

/** Signs the admin session cookie. Anyone who knows it can forge a login. */
function cookieSecret() {
  const secret = process.env.ADMIN_COOKIE_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`ADMIN_COOKIE_SECRET must be a random string of at least ${MIN_SECRET_LENGTH} characters - set it in .env`);
  }
  return secret;
}

module.exports = config;
module.exports.cookieSecret = cookieSecret;
