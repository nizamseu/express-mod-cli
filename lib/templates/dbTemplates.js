const { toEnvKey } = require("../utils/names");
const { DB_TYPES } = require("../utils/projectConfig");
const { readStatic } = require("./static");

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
 * Generate the connection helper for a driver ("mongodb" or "sql")
 */
const generateDriver = (driver, language) => readStatic(driver, language);

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
