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
const messages = require("../utils/messages");
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
  const packageJsonPath = path.join(projectPath, "package.json");
  const needsDriver = !fs.existsSync(driverPath);

  // Check everything up front, so nothing is written unless the whole command can succeed
  assertMarkers(databasesPath, [DB_CONNECTIONS]);
  if (needsDriver) {
    assertMarkers(dbPath, [DB_DRIVER_IMPORTS, DB_DRIVERS]);
  }
  const packageJson = readPackageJson(packageJsonPath);

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

  // 5. Packages this database needs
  const missing = Object.entries(dependencies).filter(
    ([pkg]) => !packageJson.dependencies?.[pkg]
  );
  let installed = true;

  if (missing.length > 0) {
    packageJson.dependencies = Object.fromEntries(
      Object.entries({
        ...packageJson.dependencies,
        ...Object.fromEntries(missing),
      }).sort(([a], [b]) => a.localeCompare(b))
    );
    fs.writeFileSync(
      packageJsonPath,
      JSON.stringify(packageJson, null, 2) + "\n"
    );

    installed = options.skipInstall ? false : installDependencies(projectPath);
  }

  console.log(
    messages.instructions.databaseAdded(name, {
      installed,
      envKeys: connectionEnv(name, dbType, dbName).map(({ key }) => key),
    })
  );
}

function readPackageJson(packageJsonPath) {
  try {
    return JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
  } catch (error) {
    throw new CliError(`Cannot read package.json: ${error.message}`);
  }
}

module.exports = { addDatabase };
