const fs = require('fs');
const path = require('path');
const { Sequelize } = require('sequelize');
const { Umzug, SequelizeStorage } = require('umzug');
const databases = require('./databases');

const SQL_TYPES = ['postgres', 'mysql'];
const connections = {};

/** Names of the SQL connections listed in ./databases.js */
function sqlConnectionNames() {
  return Object.keys(databases).filter((name) => SQL_TYPES.includes(databases[name].type));
}

/**
 * Get the Sequelize instance for a database defined in ./databases.js
 * The instance is created on first use; it connects when the first query runs.
 */
function getSqlConnection(name = 'default') {
  if (connections[name]) return connections[name];

  const config = databases[name];
  if (!config || !SQL_TYPES.includes(config.type)) {
    throw new Error(`SQL connection "${name}" is not defined in src/config/databases.js`);
  }

  const sequelize = new Sequelize(config.uri, {
    dialect: config.type,
    logging: false, // set to console.log to see the generated SQL
  });

  connections[name] = sequelize;
  return sequelize;
}

/**
 * Get the migration runner of a connection.
 * Its migrations are the files in src/migrations/<name>/, applied in file name order.
 * Applied migrations are recorded in the "SequelizeMeta" table of that database.
 */
function getMigrator(name = 'default') {
  const sequelize = getSqlConnection(name);
  const context = sequelize.getQueryInterface();
  const directory = path.join(__dirname, '..', 'migrations', name);
  const files = fs.existsSync(directory)
    ? fs.readdirSync(directory).filter((file) => /\.(js|ts)$/.test(file) && !file.endsWith('.d.ts')).sort()
    : [];

  return new Umzug({
    migrations: files.map((file) => {
      const migration = require(path.join(directory, file));
      return {
        name: file.replace(/\.(js|ts)$/, ''),
        up: () => migration.up({ context }),
        down: () => migration.down({ context }),
      };
    }),
    context,
    storage: new SequelizeStorage({ sequelize }),
    logger: undefined,
  });
}

/** Open every SQL connection listed in ./databases.js and bring its schema up to date */
async function connectAll() {
  await Promise.all(
    sqlConnectionNames().map(async (name) => {
      const sequelize = getSqlConnection(name);
      await sequelize.authenticate();

      // Pending migrations are applied on startup. Set DB_AUTO_MIGRATE=false to
      // apply them yourself with "npm run migrate" (e.g. as a deploy step when
      // several instances of the app start at the same time).
      if (process.env.DB_AUTO_MIGRATE !== 'false') {
        const applied = await getMigrator(name).up();
        for (const migration of applied) {
          console.log(`Migrated ${sequelize.getDialect()} "${name}": ${migration.name}`);
        }
      }

      console.log(`Connected to ${sequelize.getDialect()} "${name}"`);
    })
  );
}

/** Close every SQL connection */
async function disconnectAll() {
  await Promise.all(Object.values(connections).map((sequelize) => sequelize.close()));
}

module.exports = { getSqlConnection, getMigrator, sqlConnectionNames, connectAll, disconnectAll };
