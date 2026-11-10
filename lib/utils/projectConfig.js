const fs = require("fs");
const path = require("path");
const { CliError } = require("./errors");

/** Written to the root of every generated project; tells `add` / `add-db` how the project is set up. */
const CONFIG_FILE = ".expressmodrc.json";

/**
 * Supported databases.
 * `driver` is the connection helper file generated in src/config (mongodb.js / sql.js).
 */
const DB_TYPES = {
  mongodb: {
    label: "MongoDB (Mongoose)",
    driver: "mongodb",
    dependencies: { mongoose: "^9.12.1" },
  },
  postgres: {
    label: "PostgreSQL (Sequelize)",
    driver: "sql",
    dependencies: {
      sequelize: "^6.37.8",
      pg: "^8.23.1",
      "pg-hstore": "^2.3.4",
    },
  },
  mysql: {
    label: "MySQL (Sequelize)",
    driver: "sql",
    dependencies: { sequelize: "^6.37.8", mysql2: "^3.24.6" },
  },
};

const DB_TYPE_ALIASES = {
  mongo: "mongodb",
  mongoose: "mongodb",
  postgresql: "postgres",
  pg: "postgres",
};

const LANGUAGES = ["js", "ts"];

/**
 * Turn user input (mongo, PostgreSQL, pg, ...) into a supported database type
 * @param {string} input - The value passed on the command line
 * @returns {string} - One of the keys of DB_TYPES
 */
function normalizeDbType(input) {
  const value = String(input).toLowerCase();
  const type = DB_TYPE_ALIASES[value] || value;

  if (!DB_TYPES[type]) {
    throw new CliError(
      `Unsupported database "${input}". Choose one of: ${Object.keys(DB_TYPES).join(", ")}.`
    );
  }

  return type;
}

/**
 * Read the project setup from the given directory.
 * Projects generated before v1.2.0 have no config file; they are recognised by
 * the route markers in src/index.js and treated as JavaScript + single MongoDB.
 * @param {string} projectPath - The project root
 * @returns {{language: string, databases: object, legacy: boolean}|null}
 */
function loadProject(projectPath) {
  const configPath = path.join(projectPath, CONFIG_FILE);

  if (fs.existsSync(configPath)) {
    let config;
    try {
      config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    } catch (error) {
      throw new CliError(`${CONFIG_FILE} is not valid JSON: ${error.message}`);
    }

    const databases = config.databases || {};
    const invalid =
      !LANGUAGES.includes(config.language) ||
      !databases.default ||
      Object.values(databases).some((db) => !db || !DB_TYPES[db.type]);

    if (invalid) {
      throw new CliError(
        `${CONFIG_FILE} is invalid. It needs "language" ("js" or "ts") and a "databases" map with a "default" entry.`
      );
    }

    return { language: config.language, databases, legacy: false };
  }

  const legacyIndex = path.join(projectPath, "src", "index.js");
  if (
    fs.existsSync(legacyIndex) &&
    fs.readFileSync(legacyIndex, "utf-8").includes("// ROUTE_IMPORTS")
  ) {
    return {
      language: "js",
      databases: { default: { type: "mongodb" } },
      legacy: true,
    };
  }

  return null;
}

/**
 * Write the project config file
 * @param {string} projectPath - The project root
 * @param {{language: string, databases: object}} project - The project setup
 */
function saveProject(projectPath, project) {
  const config = { language: project.language, databases: project.databases };
  fs.writeFileSync(
    path.join(projectPath, CONFIG_FILE),
    JSON.stringify(config, null, 2) + "\n"
  );
}

module.exports = {
  CONFIG_FILE,
  DB_TYPES,
  normalizeDbType,
  loadProject,
  saveProject,
};
