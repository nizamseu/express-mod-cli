import '../config/env';
import { connectDB, disconnectDB } from '../config/db';
import { setUserRole } from '../modules/auth/auth.repository';

/**
 * Change a user's role, e.g. to make the first admin:
 *
 *   npm run auth:set-role -- admin@example.com admin
 */
async function main(): Promise<void> {
  const [email, role] = process.argv.slice(2);
  if (!email || !role) {
    throw new Error('Usage: npm run auth:set-role -- <email> <role>');
  }

  await connectDB();
  const user = await setUserRole(email.trim().toLowerCase(), role);
  if (!user) {
    throw new Error(`No user with the email ${email}`);
  }

  console.log(`${user.email} is now "${user.role}"`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => disconnectDB());
