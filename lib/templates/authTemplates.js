const crypto = require("crypto");
const { readStatic } = require("./static");

/** Packages the generated authentication code uses */
const AUTH_DEPENDENCIES = {
  bcryptjs: "^3.0.3",
  "cookie-parser": "^1.4.7",
  "express-rate-limit": "^8.7.4",
  jsonwebtoken: "^9.0.3",
  nodemailer: "^10.5.0",
};

/** Type definitions for TypeScript projects (bcryptjs, express-rate-limit and nodemailer ship their own) */
const AUTH_TYPE_DEPENDENCIES = {
  "@types/cookie-parser": "^1.4.10",
  "@types/jsonwebtoken": "^9.0.10",
};

/** Model names add-auth defines - no module may use them */
const AUTH_MODELS = ["User", "RefreshToken", "AuthToken"];

/**
 * Files add-auth writes, as [path relative to the project, content]
 * @param {object} options
 * @param {"mongodb"|"sql"} options.driver - Driver of the connection that stores users
 * @param {"js"|"ts"} options.language - Project language
 * @param {string} options.connection - Name of that connection
 */
function authFiles({ driver, language, connection }) {
  const read = (name) =>
    readStatic(`auth/${name}`, language).replace(/__CONNECTION__/g, connection);
  const ext = language;

  return [
    [`src/config/auth.${ext}`, read("config")],
    [`src/utils/security.${ext}`, read("security")],
    [`src/utils/mailer.${ext}`, read("mailer")],
    [`src/middleware/auth.${ext}`, read("middleware")],
    [`src/modules/auth/user.model.${ext}`, read(`${driver}-user.model`)],
    [`src/modules/auth/refresh-token.model.${ext}`, read(`${driver}-refresh-token.model`)],
    [`src/modules/auth/auth-token.model.${ext}`, read(`${driver}-auth-token.model`)],
    [`src/modules/auth/auth.repository.${ext}`, read(`${driver}-repository`)],
    [`src/modules/auth/auth.validation.${ext}`, read("validation")],
    [`src/modules/auth/auth.emails.${ext}`, read("emails")],
    [`src/modules/auth/auth.controller.${ext}`, read("controller")],
    [`src/modules/auth/auth.routes.${ext}`, read("routes")],
    [`src/scripts/set-role.${ext}`, read("set-role")],
  ];
}

/** The migration that creates the users, refresh_tokens and auth_tokens tables */
const authMigration = (language) => readStatic("auth/sql-migration", language);

/** tests/auth.test - validation and token checks that need no database */
const authTest = (language) => readStatic("auth/tests", language);

/**
 * Env variables for authentication
 * @param {{example: boolean}} options - .env.example gets a placeholder instead of a real secret
 */
const authEnv = ({ example }) => `
# Authentication (express-mod-cli add-auth)
# Signs access tokens - keep it secret, at least 32 random characters
JWT_SECRET=${example ? "change-me-to-a-long-random-string-of-at-least-32-characters" : crypto.randomBytes(48).toString("base64url")}
JWT_ACCESS_EXPIRES_IN=15m
REFRESH_TOKEN_DAYS=30
# Also return the refresh token in response bodies (for mobile apps)
AUTH_REFRESH_IN_BODY=false
# lax (same site) or none (frontend on another site, needs HTTPS)
AUTH_COOKIE_SAMESITE=lax
# Login / register / password attempts per IP per 15 minutes, for each route
AUTH_RATE_LIMIT=20

# Email verification and password reset
# Links in emails open your frontend: <APP_URL>/verify-email?token=... and <APP_URL>/reset-password?token=...
APP_URL=http://localhost:3000
# true: users must verify their email address before they can log in
AUTH_REQUIRE_VERIFIED_EMAIL=false
# Emails one client can trigger per 15 minutes (forgot-password, resend-verification)
AUTH_EMAIL_RATE_LIMIT=5

# Email (SMTP) - without SMTP_HOST, development prints emails to the console
MAIL_FROM="My App <no-reply@example.com>"
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
`;

/** npm script that changes a user's role */
const setRoleScript = (language) => ({
  "auth:set-role": language === "ts" ? "tsx src/scripts/set-role.ts" : "node src/scripts/set-role.js",
});

module.exports = {
  AUTH_DEPENDENCIES,
  AUTH_TYPE_DEPENDENCIES,
  AUTH_MODELS,
  authFiles,
  authMigration,
  authTest,
  authEnv,
  setRoleScript,
};
