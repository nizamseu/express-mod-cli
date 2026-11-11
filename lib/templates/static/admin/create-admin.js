require('dotenv').config({ quiet: true });
const crypto = require('crypto');
const { connectDB, disconnectDB } = require('../config/db');
const { saveAdmin, userExists } = require('../admin/defaultAdmin');

/**
 * Create an admin user, or make an existing user an admin:
 *
 *   npm run admin:create -- admin@example.com                   # new user: random password, printed once
 *   npm run admin:create -- admin@example.com 'S3cure-pass' 'Jane Doe'
 *   npm run admin:create -- jane@example.com                    # existing user: keeps their password
 */
async function main() {
  const [email, givenPassword, ...nameParts] = process.argv.slice(2);
  if (!email) {
    throw new Error('Usage: npm run admin:create -- <email> [password] [name]');
  }

  await connectDB();

  // A new user needs a password: without one, make one up and show it once
  const generated = !givenPassword && !(await userExists(email));
  const password = generated ? crypto.randomBytes(12).toString('base64url') : givenPassword;

  const result = await saveAdmin({ email, password, name: nameParts.join(' ') });
  console.log(result.created ? `Created the admin ${result.email}` : `${result.email} is now an admin`);
  if (generated) {
    console.log(`Password: ${password}   (shown only now - change it after logging in)`);
  }
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(() => disconnectDB());
