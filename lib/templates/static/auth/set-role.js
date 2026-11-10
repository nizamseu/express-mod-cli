require('dotenv').config({ quiet: true });
const { connectDB, disconnectDB } = require('../config/db');
const { setUserRole } = require('../modules/auth/auth.repository');

/**
 * Change a user's role, e.g. to make the first admin:
 *
 *   npm run auth:set-role -- admin@example.com admin
 */
async function main() {
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
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(() => disconnectDB());
