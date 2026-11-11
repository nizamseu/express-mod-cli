import UserModel from '../modules/auth/user.model';
import { registerSchema } from '../modules/auth/auth.validation';
import { hashPassword } from '../utils/security';
import config from './admin.config';

// Mongoose and Sequelize models take their conditions a little differently,
// so the model is used through this small common shape
interface UserDocument {
  emailVerifiedAt?: Date | null;
  set(values: Record<string, unknown>): unknown;
  save(): Promise<unknown>;
}
interface UserStore {
  findAll?: unknown;
  findOne(conditions: object): Promise<UserDocument | null>;
  count?(options: object): Promise<number>;
  countDocuments?(conditions: object): Promise<number>;
  create(values: Record<string, unknown>): Promise<unknown>;
}

const Users = UserModel as unknown as UserStore;
const isSequelize = typeof Users.findAll === 'function';
const findByEmail = (email: string) => Users.findOne(isSequelize ? { where: { email } } : { email });
const countAdmins = (): Promise<number> =>
  isSequelize ? Users.count!({ where: { role: config.role } }) : Users.countDocuments!({ role: config.role });

/** Is there a user with this email? */
export const userExists = async (email: string): Promise<boolean> =>
  Boolean(await findByEmail(String(email).trim().toLowerCase()));

/**
 * Create an admin user, or make an existing user an admin.
 * The password is optional for an existing user (their password is kept).
 * Admins are created with a verified email, so they can also use the API.
 */
export async function saveAdmin(input: { email: string; password?: string; name?: string }): Promise<{ email: string; created: boolean }> {
  const result = registerSchema.partial({ password: true }).safeParse({
    email: input.email,
    password: input.password || undefined,
    name: input.name || undefined,
  });
  if (!result.success) {
    throw new Error(result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('\n'));
  }

  const { email, password, name } = result.data;
  const changes: Record<string, unknown> = { role: config.role };
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

  await Users.create({ email, name, emailVerifiedAt: new Date(), ...changes });
  return { email, created: true };
}

/**
 * On the first start: create the admin from ADMIN_EMAIL / ADMIN_PASSWORD in .env.
 * Does nothing once the database has an admin, so later changes in the panel are kept.
 */
export async function ensureDefaultAdmin(): Promise<void> {
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
