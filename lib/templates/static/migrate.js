require('dotenv').config({ quiet: true });
const { getMigrator, sqlConnectionNames, disconnectAll } = require('../config/sql');

/**
 * Run the migrations in src/migrations/<connection>/
 *
 *   npm run migrate           apply pending migrations
 *   npm run migrate:down      undo the last applied migration
 *   npm run migrate:status    list applied and pending migrations
 *
 * Add "-- <connection>" to work on one connection only:
 *   npm run migrate:down -- analytics
 */
async function main() {
  const [command = 'up', only] = process.argv.slice(2);
  const names = sqlConnectionNames().filter((name) => !only || name === only);
  const list = (migrations) => migrations.map((migration) => migration.name).join(', ');

  if (names.length === 0) {
    throw new Error(only ? `"${only}" is not a SQL connection in src/config/databases.js` : 'No SQL connection is configured');
  }
  if (command === 'down' && names.length > 1) {
    throw new Error('There are several SQL connections - name the one to roll back: npm run migrate:down -- <connection>');
  }

  for (const name of names) {
    const migrator = getMigrator(name);

    if (command === 'up') {
      const applied = await migrator.up();
      console.log(`[${name}] ${applied.length ? `applied: ${list(applied)}` : 'nothing to migrate'}`);
    } else if (command === 'down') {
      const reverted = await migrator.down();
      console.log(`[${name}] ${reverted.length ? `reverted: ${list(reverted)}` : 'nothing to revert'}`);
    } else if (command === 'status') {
      console.log(`[${name}] applied: ${list(await migrator.executed()) || '-'}`);
      console.log(`[${name}] pending: ${list(await migrator.pending()) || '-'}`);
    } else {
      throw new Error(`Unknown command "${command}". Use up, down or status.`);
    }
  }
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(() => disconnectAll());
