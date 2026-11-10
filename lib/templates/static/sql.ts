import fs from 'node:fs';
import path from 'node:path';
import { Sequelize, type QueryInterface } from 'sequelize';
import { SequelizeStorage, Umzug } from 'umzug';
import databases from './databases';

/** What a file in src/migrations/<connection>/ exports */
interface Migration {
  up(params: { context: QueryInterface }): Promise<void>;
  down(params: { context: QueryInterface }): Promise<void>;
}

const connections: Record<string, Sequelize> = {};

/** Names of the SQL connections listed in ./databases.ts */
export function sqlConnectionNames(): string[] {
  return Object.keys(databases).filter((name) => {
    const type = databases[name]?.type;
    return type === 'postgres' || type === 'mysql';
  });
}

/**
 * Get the Sequelize instance for a database defined in ./databases.ts
 * The instance is created on first use; it connects when the first query runs.
 */
export function getSqlConnection(name = 'default'): Sequelize {
  const existing = connections[name];
  if (existing) return existing;

  const config = databases[name];
  if (!config || (config.type !== 'postgres' && config.type !== 'mysql')) {
    throw new Error(`SQL connection "${name}" is not defined in src/config/databases.ts`);
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
export function getMigrator(name = 'default'): Umzug<QueryInterface> {
  const sequelize = getSqlConnection(name);
  const context = sequelize.getQueryInterface();
  const directory = path.join(__dirname, '..', 'migrations', name);
  const files = fs.existsSync(directory)
    ? fs.readdirSync(directory).filter((file) => /\.(js|ts)$/.test(file) && !file.endsWith('.d.ts')).sort()
    : [];

  return new Umzug({
    migrations: files.map((file) => {
      const migration: Migration = require(path.join(directory, file));
      return {
        // Without the extension, so the name is the same when running from src/ (.ts) and dist/ (.js)
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

/** Open every SQL connection listed in ./databases.ts and bring its schema up to date */
export async function connectAll(): Promise<void> {
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
export async function disconnectAll(): Promise<void> {
  await Promise.all(Object.values(connections).map((sequelize) => sequelize.close()));
}
