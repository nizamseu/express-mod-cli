const { toEnvKey } = require("../utils/names");
const { DB_TYPES } = require("../utils/projectConfig");

/**
 * Env variables (with local development defaults) for one connection.
 * The default connection keeps the conventional names (MONGODB_URI / DATABASE_URL);
 * named connections use DB_<NAME>_URI.
 * @returns {{field: string, key: string, value: string}[]}
 */
const connectionEnv = (name, type, dbName) => {
  const isDefault = name === "default";
  const prefix = `DB_${toEnvKey(name)}`;

  if (type === "mongodb") {
    return [
      {
        field: "uri",
        key: isDefault ? "MONGODB_URI" : `${prefix}_URI`,
        value: "mongodb://localhost:27017",
      },
      {
        field: "dbName",
        key: isDefault ? "DB_NAME" : `${prefix}_NAME`,
        value: dbName,
      },
    ];
  }

  return [
    {
      field: "uri",
      key: isDefault ? "DATABASE_URL" : `${prefix}_URI`,
      value:
        type === "postgres"
          ? `postgres://postgres:postgres@localhost:5432/${dbName}`
          : `mysql://root:password@localhost:3306/${dbName}`,
    },
  ];
};

/**
 * Generate one entry of the `databases` object in src/config/databases
 * (the syntax is the same for JavaScript and TypeScript)
 */
const generateConnectionEntry = (name, type, dbName) => {
  const fields = connectionEnv(name, type, dbName)
    .map(({ field, key, value }) => `  ${field}: process.env.${key} || '${value}',`)
    .join("\n");

  return `${name}: {\n  type: '${type}',\n${fields}\n},`;
};

/**
 * Generate the .env lines for one connection
 */
const generateConnectionEnv = (name, type, dbName) => {
  const lines = connectionEnv(name, type, dbName)
    .map(({ key, value }) => `${key}=${value}`)
    .join("\n");

  return `# Database connection "${name}" - ${DB_TYPES[type].label}\n${lines}`;
};

/**
 * Generate src/config/databases - the list of database connections
 */
const generateDatabasesConfig = ({ language, type, dbName }) => {
  const entry = generateConnectionEntry("default", type, dbName)
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");

  const intro = `
/**
 * Database connections used by this project.
 * Each key is a connection name; models pick one with
 * getMongoConnection('<name>') or getSqlConnection('<name>').
 *
 * Run "express-mod-cli add-db <name>" to add another connection -
 * new entries are inserted below the DB_CONNECTIONS marker.
 */`;

  if (language === "ts") {
    return `${intro}
export type DatabaseType = 'mongodb' | 'postgres' | 'mysql';

export interface DatabaseConfig {
  type: DatabaseType;
  uri: string;
  /** MongoDB only - SQL connections carry the database name in the uri */
  dbName?: string;
}

const databases: Record<string, DatabaseConfig> = {
  // DB_CONNECTIONS
${entry}
};

export default databases;
`;
  }

  return `${intro}
const databases = {
  // DB_CONNECTIONS
${entry}
};

module.exports = databases;
`;
};

/** Statements that register a driver (mongodb / sql) in src/config/db */
const driverImport = (driver, language) =>
  language === "ts"
    ? `import * as ${driver}Driver from './${driver}';`
    : `const ${driver}Driver = require('./${driver}');`;

const driverListItem = (driver) => `${driver}Driver,`;

/**
 * Generate src/config/db - connects / disconnects every configured database
 */
const generateDbConfig = ({ language, type }) => {
  const driver = DB_TYPES[type].driver;

  if (language === "ts") {
    return `
// Database drivers are registered below (managed by "express-mod-cli add-db")
// DB_DRIVER_IMPORTS
${driverImport(driver, language)}

interface DatabaseDriver {
  connectAll(): Promise<void>;
  disconnectAll(): Promise<void>;
}

const drivers: DatabaseDriver[] = [
  // DB_DRIVERS
  ${driverListItem(driver)}
];

/** Connect every database listed in ./databases.ts */
export async function connectDB(): Promise<void> {
  await Promise.all(drivers.map((driver) => driver.connectAll()));
}

/** Close every open database connection */
export async function disconnectDB(): Promise<void> {
  const results = await Promise.allSettled(drivers.map((driver) => driver.disconnectAll()));

  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('Error disconnecting from database:', result.reason);
    }
  }
}
`;
  }

  return `
// Database drivers are registered below (managed by "express-mod-cli add-db")
// DB_DRIVER_IMPORTS
${driverImport(driver, language)}

const drivers = [
  // DB_DRIVERS
  ${driverListItem(driver)}
];

/** Connect every database listed in ./databases.js */
async function connectDB() {
  await Promise.all(drivers.map((driver) => driver.connectAll()));
}

/** Close every open database connection */
async function disconnectDB() {
  const results = await Promise.allSettled(drivers.map((driver) => driver.disconnectAll()));

  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('Error disconnecting from database:', result.reason);
    }
  }
}

module.exports = { connectDB, disconnectDB };
`;
};

/**
 * Generate src/config/mongodb - one Mongoose connection per MongoDB database
 */
const generateMongoDriver = (language) => {
  if (language === "ts") {
    return `
import mongoose, { type Connection } from 'mongoose';
import databases from './databases';

const connections: Record<string, Connection> = {};

/**
 * Get the Mongoose connection for a database defined in ./databases.ts
 * The connection is created on first use; queries are buffered until it is open.
 */
export function getMongoConnection(name = 'default'): Connection {
  const existing = connections[name];
  if (existing) return existing;

  const config = databases[name];
  if (!config || config.type !== 'mongodb') {
    throw new Error(\`MongoDB connection "\${name}" is not defined in src/config/databases.ts\`);
  }

  const connection = mongoose.createConnection(config.uri, { dbName: config.dbName });

  connection.on('error', (err) => {
    console.error(\`MongoDB "\${name}" connection error:\`, err);
  });
  connection.on('disconnected', () => {
    console.log(\`MongoDB "\${name}" disconnected\`);
  });

  connections[name] = connection;
  return connection;
}

/** Open every MongoDB connection listed in ./databases.ts */
export async function connectAll(): Promise<void> {
  const names = Object.keys(databases).filter((name) => databases[name]?.type === 'mongodb');

  await Promise.all(
    names.map(async (name) => {
      await getMongoConnection(name).asPromise();
      console.log(\`Connected to MongoDB "\${name}"\`);
    })
  );
}

/** Close every open MongoDB connection */
export async function disconnectAll(): Promise<void> {
  await Promise.all(Object.values(connections).map((connection) => connection.close()));
}
`;
  }

  return `
const mongoose = require('mongoose');
const databases = require('./databases');

const connections = {};

/**
 * Get the Mongoose connection for a database defined in ./databases.js
 * The connection is created on first use; queries are buffered until it is open.
 */
function getMongoConnection(name = 'default') {
  if (connections[name]) return connections[name];

  const config = databases[name];
  if (!config || config.type !== 'mongodb') {
    throw new Error(\`MongoDB connection "\${name}" is not defined in src/config/databases.js\`);
  }

  const connection = mongoose.createConnection(config.uri, { dbName: config.dbName });

  connection.on('error', (err) => {
    console.error(\`MongoDB "\${name}" connection error:\`, err);
  });
  connection.on('disconnected', () => {
    console.log(\`MongoDB "\${name}" disconnected\`);
  });

  connections[name] = connection;
  return connection;
}

/** Open every MongoDB connection listed in ./databases.js */
async function connectAll() {
  const names = Object.keys(databases).filter((name) => databases[name].type === 'mongodb');

  await Promise.all(
    names.map(async (name) => {
      await getMongoConnection(name).asPromise();
      console.log(\`Connected to MongoDB "\${name}"\`);
    })
  );
}

/** Close every open MongoDB connection */
async function disconnectAll() {
  await Promise.all(Object.values(connections).map((connection) => connection.close()));
}

module.exports = { getMongoConnection, connectAll, disconnectAll };
`;
};

/**
 * Generate src/config/sql - one Sequelize instance per PostgreSQL / MySQL database
 */
const generateSqlDriver = (language) => {
  if (language === "ts") {
    return `
import { Sequelize } from 'sequelize';
import databases from './databases';

const connections: Record<string, Sequelize> = {};

const isSql = (name: string): boolean => {
  const type = databases[name]?.type;
  return type === 'postgres' || type === 'mysql';
};

/**
 * Get the Sequelize instance for a database defined in ./databases.ts
 * The instance is created on first use.
 */
export function getSqlConnection(name = 'default'): Sequelize {
  const existing = connections[name];
  if (existing) return existing;

  const config = databases[name];
  if (!config || (config.type !== 'postgres' && config.type !== 'mysql')) {
    throw new Error(\`SQL connection "\${name}" is not defined in src/config/databases.ts\`);
  }

  const sequelize = new Sequelize(config.uri, {
    dialect: config.type,
    logging: false, // set to console.log to see the generated SQL
  });

  connections[name] = sequelize;
  return sequelize;
}

/** Open every SQL connection listed in ./databases.ts */
export async function connectAll(): Promise<void> {
  const names = Object.keys(databases).filter(isSql);

  await Promise.all(
    names.map(async (name) => {
      const sequelize = getSqlConnection(name);
      await sequelize.authenticate();
      // Creates the table of every model that doesn't have one yet.
      // It never alters existing tables - use migrations for schema changes.
      await sequelize.sync();
      console.log(\`Connected to \${sequelize.getDialect()} "\${name}"\`);
    })
  );
}

/** Close every open SQL connection */
export async function disconnectAll(): Promise<void> {
  await Promise.all(Object.values(connections).map((sequelize) => sequelize.close()));
}
`;
  }

  return `
const { Sequelize } = require('sequelize');
const databases = require('./databases');

const SQL_TYPES = ['postgres', 'mysql'];
const connections = {};

/**
 * Get the Sequelize instance for a database defined in ./databases.js
 * The instance is created on first use.
 */
function getSqlConnection(name = 'default') {
  if (connections[name]) return connections[name];

  const config = databases[name];
  if (!config || !SQL_TYPES.includes(config.type)) {
    throw new Error(\`SQL connection "\${name}" is not defined in src/config/databases.js\`);
  }

  const sequelize = new Sequelize(config.uri, {
    dialect: config.type,
    logging: false, // set to console.log to see the generated SQL
  });

  connections[name] = sequelize;
  return sequelize;
}

/** Open every SQL connection listed in ./databases.js */
async function connectAll() {
  const names = Object.keys(databases).filter((name) => SQL_TYPES.includes(databases[name].type));

  await Promise.all(
    names.map(async (name) => {
      const sequelize = getSqlConnection(name);
      await sequelize.authenticate();
      // Creates the table of every model that doesn't have one yet.
      // It never alters existing tables - use migrations for schema changes.
      await sequelize.sync();
      console.log(\`Connected to \${sequelize.getDialect()} "\${name}"\`);
    })
  );
}

/** Close every open SQL connection */
async function disconnectAll() {
  await Promise.all(Object.values(connections).map((sequelize) => sequelize.close()));
}

module.exports = { getSqlConnection, connectAll, disconnectAll };
`;
};

/**
 * Generate the connection helper for a driver ("mongodb" or "sql")
 */
const generateDriver = (driver, language) =>
  driver === "mongodb"
    ? generateMongoDriver(language)
    : generateSqlDriver(language);

module.exports = {
  connectionEnv,
  generateConnectionEntry,
  generateConnectionEnv,
  generateDatabasesConfig,
  generateDbConfig,
  generateDriver,
  driverImport,
  driverListItem,
};
