const path = require("path");
const fs = require("fs");
const {
  createFile,
  assertMarkers,
  insertAfterMarker,
  appendToFile,
} = require("../utils/fileUtils");
const { CliError } = require("../utils/errors");
const { validateConnectionName } = require("../utils/names");
const {
  DB_TYPES,
  normalizeDbType,
  loadProject,
  saveProject,
} = require("../utils/projectConfig");
const { installDependencies } = require("../utils/npm");
const {
  supportsMigrations,
  ensureMigrationSupport,
  readPackageJson,
  writePackageJson,
  addDependencies,
} = require("../utils/projectSupport");
const messages = require("../utils/messages");
const { ADMIN_ADAPTERS } = require("../templates/adminjsTemplates");
const {
  connectionEnv,
  generateConnectionEntry,
  generateConnectionEnv,
  generateDriver,
  driverImport,
  driverListItem,
} = require("../templates/dbTemplates");

const DB_CONNECTIONS = "// DB_CONNECTIONS";
const DB_DRIVER_IMPORTS = "// DB_DRIVER_IMPORTS";
const DB_DRIVERS = "// DB_DRIVERS";

/**
 * Add another database connection to an existing project
 * @param {string} name - The connection name (used by models and in env variable names)
 * @param {object} [options]
 * @param {string} [options.dbType] - Database type (default: the type of the default connection)
 * @param {boolean} [options.skipInstall] - Don't run "npm install" for newly needed packages
 */
function addDatabase(name, options = {}) {
  const projectPath = process.cwd();
  const project = loadProject(projectPath);

  if (!project) {
    throw new CliError(messages.error.notInProject);
  }
  if (project.legacy) {
    throw new CliError(messages.error.legacyProject);
  }

  validateConnectionName(name);
  if (Object.hasOwn(project.databases, name)) {
    throw new CliError(messages.error.connectionExists(name));
  }

  const dbType = normalizeDbType(
    options.dbType || project.databases.default.type
  );
  const { language } = project;
  const { driver, dependencies } = DB_TYPES[dbType];
  const configPath = path.join(projectPath, "src", "config");
  const databasesPath = path.join(configPath, `databases.${language}`);
  const dbPath = path.join(configPath, `db.${language}`);
  const driverPath = path.join(configPath, `${driver}.${language}`);
  const needsDriver = !fs.existsSync(driverPath);

  // Check everything up front, so nothing is written unless the whole command can succeed
  assertMarkers(databasesPath, [DB_CONNECTIONS]);
  if (needsDriver) {
    assertMarkers(dbPath, [DB_DRIVER_IMPORTS, DB_DRIVERS]);
  }
  const packageJson = readPackageJson(projectPath);

  console.log(messages.info.addingDatabase(name, dbType));

  // 1. Connection entry in src/config/databases
  const dbName = name.toLowerCase();
  insertAfterMarker(
    databasesPath,
    DB_CONNECTIONS,
    generateConnectionEntry(name, dbType, dbName)
  );

  // 2. Connection helper (mongodb / sql), the first time this kind of database is used
  if (needsDriver) {
    createFile(driverPath, generateDriver(driver, language));
    insertAfterMarker(dbPath, DB_DRIVER_IMPORTS, driverImport(driver, language));
    insertAfterMarker(dbPath, DB_DRIVERS, driverListItem(driver));
  }

  // 3. Env variables
  const envBlock = generateConnectionEnv(name, dbType, dbName);
  appendToFile(path.join(projectPath, ".env"), envBlock);
  appendToFile(path.join(projectPath, ".env.example"), envBlock);

  // 4. Project config
  project.databases[name] = { type: dbType };
  saveProject(projectPath, project);

  // 5. Migration runner, the first time a SQL database is added
  const scriptsBefore = JSON.stringify(packageJson.scripts);
  if (driver === "sql" && supportsMigrations(projectPath, language)) {
    ensureMigrationSupport(projectPath, language, packageJson);
  }

  // 6. Packages this database needs (and the admin panel's adapter for it)
  const missing = [
    ...addDependencies(packageJson, dependencies),
    ...(project.admin ? addDependencies(packageJson, ADMIN_ADAPTERS[driver]) : []),
  ];
  let installed = true;

  if (missing.length > 0 || JSON.stringify(packageJson.scripts) !== scriptsBefore) {
    writePackageJson(projectPath, packageJson);
  }
  if (missing.length > 0) {
    installed = options.skipInstall ? false : installDependencies(projectPath);
  }

  console.log(
    messages.instructions.databaseAdded(name, {
      installed,
      envKeys: connectionEnv(name, dbType, dbName).map(({ key }) => key),
    })
  );
}

module.exports = { addDatabase };
