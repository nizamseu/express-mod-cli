const path = require("path");
const fs = require("fs");
const {
  createFile,
  assertMarkers,
  insertAfterMarker,
  insertAfterLine,
  setEnvBlock,
} = require("../utils/fileUtils");
const { CliError } = require("../utils/errors");
const { moduleNames } = require("../utils/names");
const { DB_TYPES, loadProject, saveProject } = require("../utils/projectConfig");
const { installDependencies } = require("../utils/npm");
const {
  routesFile,
  supportsMigrations,
  supportsTests,
  ensureModuleSupport,
  readPackageJson,
  writePackageJson,
  addDependencies,
} = require("../utils/projectSupport");
const messages = require("../utils/messages");
const { routeRegistration } = require("../templates/moduleTemplates");
const { migrationPath } = require("../templates/migrationTemplates");
const {
  AUTH_DEPENDENCIES,
  AUTH_TYPE_DEPENDENCIES,
  AUTH_MODELS,
  authFiles,
  authMigration,
  authTest,
  authEnv,
  setRoleScript,
} = require("../templates/authTemplates");

const ROUTE_IMPORTS = "// ROUTE_IMPORTS";
const ROUTE_MIDDLEWARE = "// ROUTE_MIDDLEWARE";

/** Where cookie-parser is added in the app file */
const cookieParserSetup = (language) => ({
  importAfter: language === "ts" ? /from ['"]helmet['"]/ : /require\(['"]helmet['"]\)/,
  importStatement:
    language === "ts"
      ? "import cookieParser from 'cookie-parser';"
      : "const cookieParser = require('cookie-parser');",
  useAfter: /app\.use\(express\.urlencoded\(/,
  useStatement: "app.use(cookieParser());",
});

/**
 * Add authentication: register, login, refresh tokens, logout, me, change password,
 * and the requireAuth / requireRole middleware.
 * @param {object} [options]
 * @param {string} [options.connection] - Database connection that stores users (default: default)
 * @param {boolean} [options.skipInstall] - Don't run "npm install"
 */
function addAuth(options = {}) {
  const projectPath = process.cwd();
  const project = loadProject(projectPath);

  if (!project) {
    throw new CliError(messages.error.notInProject);
  }
  if (project.legacy) {
    throw new CliError(messages.error.legacyProject);
  }
  if (project.auth) {
    throw new CliError(messages.error.authExists(project.auth.connection));
  }

  const connection = options.connection || "default";
  if (!Object.hasOwn(project.databases, connection)) {
    throw new CliError(
      messages.error.unknownConnection(connection, Object.keys(project.databases))
    );
  }

  const { language } = project;
  const driver = DB_TYPES[project.databases[connection].type].driver;
  const appPath = routesFile(projectPath, language);
  const appName = path.relative(projectPath, appPath);
  const cookies = cookieParserSetup(language);
  const files = authFiles({ driver, language, connection });

  // Check everything up front, so nothing is written unless the whole command can succeed
  assertMarkers(appPath, [ROUTE_IMPORTS, ROUTE_MIDDLEWARE]);

  const appLines = fs.readFileSync(appPath, "utf-8").split("\n");
  if (!appLines.some((line) => cookies.importAfter.test(line)) || !appLines.some((line) => cookies.useAfter.test(line))) {
    throw new CliError(messages.error.appChanged(appName, cookies.importStatement, cookies.useStatement));
  }

  const existingFile = files.map(([file]) => file).find((file) => fs.existsSync(path.join(projectPath, file)));
  if (existingFile) {
    throw new CliError(messages.error.authFileExists(existingFile));
  }

  const modulesDir = path.join(projectPath, "src", "modules");
  const clash = fs.existsSync(modulesDir)
    ? fs
        .readdirSync(modulesDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .find((entry) => AUTH_MODELS.includes(moduleNames(entry.name).singularPascal))
    : undefined;
  if (clash) {
    throw new CliError(messages.error.authModelTaken(moduleNames(clash.name).singularPascal, clash.name));
  }

  const packageJson = readPackageJson(projectPath);

  console.log(messages.info.addingAuth(connection));

  const created = [];
  const write = (relativePath, content) => {
    createFile(path.join(projectPath, relativePath), content);
    created.push(relativePath);
  };

  for (const [file, content] of files) {
    write(file, content);
  }
  ensureModuleSupport(projectPath, language);

  if (driver === "sql" && supportsMigrations(projectPath, language)) {
    const migration = migrationPath(projectPath, connection, "create-auth-tables", language);
    write(path.relative(projectPath, migration), authMigration(language));
  }

  if (supportsTests(projectPath, language, packageJson)) {
    write(`tests/auth.test.${language}`, authTest(language));
  }

  // Routes and cookie parsing
  const registration = routeRegistration("auth", language);
  insertAfterMarker(appPath, ROUTE_IMPORTS, registration.importStatement);
  insertAfterMarker(appPath, ROUTE_MIDDLEWARE, registration.middlewareStatement);
  insertAfterLine(appPath, cookies.importAfter, cookies.importStatement);
  insertAfterLine(appPath, cookies.useAfter, cookies.useStatement);

  // Settings
  setEnvBlock(path.join(projectPath, ".env"), authEnv({ example: false }));
  setEnvBlock(path.join(projectPath, ".env.example"), authEnv({ example: true }));

  // Packages and scripts
  const added = [
    ...addDependencies(packageJson, AUTH_DEPENDENCIES),
    ...(language === "ts" ? addDependencies(packageJson, AUTH_TYPE_DEPENDENCIES, { dev: true }) : []),
  ];
  // Added after the existing scripts; an existing script with that name is kept
  const existingScripts = packageJson.scripts || {};
  packageJson.scripts = { ...existingScripts, ...setRoleScript(language), ...existingScripts };
  writePackageJson(projectPath, packageJson);

  project.auth = { connection };
  saveProject(projectPath, project);

  let installed = true;
  if (added.length > 0) {
    installed = options.skipInstall ? false : installDependencies(projectPath);
  }

  console.log(messages.instructions.authAdded({ created, connection, installed, appName }));
}

module.exports = { addAuth };
