const UserModel = require('../modules/auth/user.model');
const { registerSchema } = require('../modules/auth/auth.validation');
const { hashPassword } = require('../utils/security');
const config = require('./admin.config');

// Mongoose and Sequelize models take their conditions a little differently
const isSequelize = typeof UserModel.findAll === 'function';
const findByEmail = (email) => UserModel.findOne(isSequelize ? { where: { email } } : { email });
const countAdmins = () =>
  isSequelize
    ? UserModel.count({ where: { role: config.role } })
    : UserModel.countDocuments({ role: config.role });

/** Is there a user with this email? */
const userExists = async (email) => Boolean(await findByEmail(String(email).trim().toLowerCase()));

/**
 * Create an admin user, or make an existing user an admin.
 * The password is optional for an existing user (their password is kept).
 * Admins are created with a verified email, so they can also use the API.
 * @param {{ email: string, password?: string, name?: string }} input
 * @returns {Promise<{ email: string, created: boolean }>}
 */
async function saveAdmin(input) {
  const result = registerSchema.partial({ password: true }).safeParse({
    email: input.email,
    password: input.password || undefined,
    name: input.name || undefined,
  });
  if (!result.success) {
    throw new Error(result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('\n'));
  }

  const { email, password, name } = result.data;
  const changes = { role: config.role };
  if (password) changes.passwordHash = await hashPassword(password);

  const existing = await findByEmail(email);
  if (existing) {
    if (!existing.emailVerifiedAt) changes.emailVerifiedAt = new Date();
    existing.set(changes);
    await existing.save();
    return { email, created: false };
  }

  if (!password) {
    throw new Error(`There is no user with the email ${email} - give a password to create one.`);
  }

  await UserModel.create({ email, name, emailVerifiedAt: new Date(), ...changes });
  return { email, created: true };
}

/**
 * On the first start: create the admin from ADMIN_EMAIL / ADMIN_PASSWORD in .env.
 * Does nothing once the database has an admin, so later changes in the panel are kept.
 */
async function ensureDefaultAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password || (await countAdmins()) > 0) return;

  if (await userExists(email)) {
    // Never hand admin rights to an existing account automatically
    console.warn(
      `ADMIN_EMAIL ${email} belongs to a user who is not an admin. Make them one with: npm run admin:create -- ${email}`
    );
    return;
  }

  await saveAdmin({ email, password, name: process.env.ADMIN_NAME || 'Admin' });
  console.log(`Created the admin user ${email} (password: ADMIN_PASSWORD in .env). Change the password after logging in.`);
}

module.exports = { saveAdmin, userExists, ensureDefaultAdmin };
