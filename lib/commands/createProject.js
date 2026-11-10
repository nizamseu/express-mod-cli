const fs = require("fs");
const path = require("path");
const { createFile } = require("../utils/fileUtils");
const { CliError } = require("../utils/errors");
const { validateProjectName, toSnakeCase } = require("../utils/names");
const {
  DB_TYPES,
  normalizeDbType,
  saveProject,
} = require("../utils/projectConfig");
const { installDependencies } = require("../utils/npm");
const {
  ensureModuleSupport,
  ensureMigrationSupport,
  readPackageJson,
  writePackageJson,
} = require("../utils/projectSupport");
const messages = require("../utils/messages");
const {
  generatePackageJson,
  generateTsConfig,
  generateEnvLoader,
  generateAppContent,
  generateServerContent,
  generateAppTest,
  generateErrorHandler,
  generateEnvFile,
  generateGitignore,
} = require("../templates/projectTemplates");
const {
  connectionEnv,
  generateDatabasesConfig,
  generateDbConfig,
  generateDriver,
} = require("../templates/dbTemplates");

/**
 * Create a new Express project with modular architecture
 * @param {string} projectName - The name of the project to create
 * @param {object} [options]
 * @param {"js"|"ts"} [options.language] - Project language (default: js)
 * @param {string} [options.dbType] - Database of the default connection (default: mongodb)
 * @param {boolean} [options.skipInstall] - Don't run "npm install"
 */
function createProject(projectName, options = {}) {
  validateProjectName(projectName);

  const language = options.language || "js";
  const dbType = normalizeDbType(options.dbType || "mongodb");
  const projectPath = path.join(process.cwd(), projectName);

  if (fs.existsSync(projectPath)) {
    throw new CliError(messages.error.directoryExists(projectName));
  }

  console.log(messages.info.creating(projectPath, language, dbType));

  // Database names can't contain "." or "-"
  const dbName = `${toSnakeCase(projectName).replace(/[^a-z0-9_]/g, "_")}_db`;

  // Write every file before installing, so a failed install still leaves a complete project
  createProjectFiles(projectPath, projectName, { language, dbType, dbName });

  const installed = options.skipInstall
    ? false
    : installDependencies(projectPath);

  console.log(
    messages.instructions.getStarted(projectName, {
      installed,
      language,
      sql: DB_TYPES[dbType].driver === "sql",
      envKeys: connectionEnv("default", dbType, dbName).map(({ key }) => key),
    })
  );
}

/**
 * Create all the project files with their content
 * @param {string} projectPath - The path where the project is created
 * @param {string} projectName - The name of the project
 * @param {{language: string, dbType: string, dbName: string}} setup - Project setup
 */
function createProjectFiles(projectPath, projectName, setup) {
  const { language, dbType, dbName } = setup;
  const srcPath = path.join(projectPath, "src");
  const configPath = path.join(srcPath, "config");
  const driver = DB_TYPES[dbType].driver;
  const source = (name) => `${name}.${language}`;

  // Directories that start out empty
  fs.mkdirSync(path.join(srcPath, "modules"), { recursive: true });

  createFile(
    path.join(projectPath, "package.json"),
    JSON.stringify(generatePackageJson(projectName, setup), null, 2)
  );

  // The Express app (routes, middleware) and the server that starts it
  createFile(path.join(srcPath, source("app")), generateAppContent(language));
  createFile(path.join(srcPath, source("index")), generateServerContent(language));

  // Database configuration: connection list, connect/disconnect, driver helper
  createFile(
    path.join(configPath, source("databases")),
    generateDatabasesConfig({ language, type: dbType, dbName })
  );
  createFile(
    path.join(configPath, source("db")),
    generateDbConfig({ language, type: dbType })
  );
  createFile(
    path.join(configPath, source(driver)),
    generateDriver(driver, language)
  );

  // Error handler, request validation and list query helpers
  createFile(
    path.join(srcPath, "middleware", source("errorHandler")),
    generateErrorHandler(language)
  );
  ensureModuleSupport(projectPath, language);

  // SQL databases: migration runner (the package.json scripts are already there)
  if (driver === "sql") {
    const packageJson = readPackageJson(projectPath);
    ensureMigrationSupport(projectPath, language, packageJson);
    writePackageJson(projectPath, packageJson);
  }

  // Tests that run without a database
  createFile(path.join(projectPath, "tests", source("app.test")), generateAppTest(language));

  if (language === "ts") {
    createFile(
      path.join(projectPath, "tsconfig.json"),
      JSON.stringify(generateTsConfig(), null, 2)
    );
    createFile(path.join(configPath, "env.ts"), generateEnvLoader());
  }

  // Environment files (.env is git-ignored, .env.example documents the variables)
  const envContent = generateEnvFile({ dbType, dbName });
  createFile(path.join(projectPath, ".env"), envContent);
  createFile(path.join(projectPath, ".env.example"), envContent);

  createFile(path.join(projectPath, ".gitignore"), generateGitignore());

  // Lets "add" and "add-db" know how this project is set up
  saveProject(projectPath, {
    language,
    databases: { default: { type: dbType } },
  });
}

module.exports = { createProject };
