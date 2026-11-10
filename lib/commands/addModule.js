const path = require("path");
const fs = require("fs");
const { createFile, assertMarkers, insertAfterMarker } = require("../utils/fileUtils");
const { CliError } = require("../utils/errors");
const { validateModuleName, moduleNames } = require("../utils/names");
const { parseFields } = require("../utils/fields");
const { DB_TYPES, loadProject } = require("../utils/projectConfig");
const { installDependencies } = require("../utils/npm");
const {
  MODULE_DEPENDENCIES,
  routesFile,
  supportsMigrations,
  supportsTests,
  ensureModuleSupport,
  readPackageJson,
  writePackageJson,
  addDependencies,
} = require("../utils/projectSupport");
const messages = require("../utils/messages");
const {
  generateModelContent,
  generateValidationContent,
  generateControllerContent,
  generateRouteContent,
  generateModuleTest,
  routeRegistration,
} = require("../templates/moduleTemplates");
const {
  migrationPath,
  generateCreateTableMigration,
} = require("../templates/migrationTemplates");

const ROUTE_IMPORTS = "// ROUTE_IMPORTS";
const ROUTE_MIDDLEWARE = "// ROUTE_MIDDLEWARE";

/**
 * Add a new module to an existing Express project
 * @param {string} moduleName - The name of the module to add
 * @param {object} [options]
 * @param {string[]} [options.fields] - Field definitions (name:string price:number ...)
 * @param {string} [options.connection] - Database connection the module uses (default: default)
 * @param {boolean} [options.skipInstall] - Don't run "npm install" for newly needed packages
 */
function addModule(moduleName, options = {}) {
  const projectPath = process.cwd();
  const project = loadProject(projectPath);

  if (!project) {
    throw new CliError(messages.error.notInProject);
  }

  validateModuleName(moduleName);
  const fields = parseFields(options.fields);

  const connection = options.connection || "default";
  if (project.legacy && connection !== "default") {
    throw new CliError(messages.error.legacyProject);
  }
  if (!Object.hasOwn(project.databases, connection)) {
    throw new CliError(
      messages.error.unknownConnection(connection, Object.keys(project.databases))
    );
  }

  const { language } = project;
  const dbType = project.databases[connection].type;
  const sql = DB_TYPES[dbType].driver === "sql";
  const indexPath = routesFile(projectPath, language);
  const modulesDir = path.join(projectPath, "src", "modules");
  const moduleDir = path.join(modulesDir, moduleName);
  const registration = routeRegistration(moduleName, language);
  const names = moduleNames(moduleName);

  // Check everything up front, so nothing is written unless the whole command can succeed
  assertMarkers(indexPath, [ROUTE_IMPORTS, ROUTE_MIDDLEWARE]);

  if (fs.existsSync(moduleDir)) {
    throw new CliError(messages.error.moduleExists(moduleName));
  }

  // e.g. "user-profile" and "user_profile" would both become userProfileRoutes
  const indexContent = fs.readFileSync(indexPath, "utf-8");
  if (new RegExp(`\\b${registration.identifier}\\b`).test(indexContent)) {
    throw new CliError(messages.error.routeNameTaken(registration.identifier));
  }

  // e.g. "user" and "users" would both define the model "User" (and the table "users")
  const existing = fs.existsSync(modulesDir)
    ? fs.readdirSync(modulesDir, { withFileTypes: true }).filter((entry) => entry.isDirectory())
    : [];
  const clash = existing.find(
    (entry) => moduleNames(entry.name).singularPascal === names.singularPascal
  );
  if (clash) {
    throw new CliError(messages.error.modelNameTaken(names.singularPascal, clash.name));
  }

  const packageJson = readPackageJson(projectPath);

  console.log(messages.info.adding(moduleName, connection));

  const templateOptions = {
    name: moduleName,
    language,
    connection,
    dbType,
    fields,
    legacy: project.legacy,
  };
  const file = (suffix) => path.join(moduleDir, `${moduleName}.${suffix}.${language}`);
  const created = [];
  const write = (filePath, content) => {
    createFile(filePath, content);
    created.push(path.relative(projectPath, filePath));
  };

  write(file("model"), generateModelContent(templateOptions));
  write(file("validation"), generateValidationContent(templateOptions));
  write(file("controller"), generateControllerContent(templateOptions));
  write(file("routes"), generateRouteContent(templateOptions));

  ensureModuleSupport(projectPath, language);

  if (supportsTests(projectPath, language, packageJson)) {
    write(
      path.join(projectPath, "tests", `${moduleName}.test.${language}`),
      generateModuleTest(templateOptions)
    );
  }

  // SQL tables are created by a migration, which also runs on the next start
  if (sql && supportsMigrations(projectPath, language)) {
    write(
      migrationPath(projectPath, connection, `create-${names.table.replace(/_/g, "-")}`, language),
      generateCreateTableMigration(templateOptions)
    );
  }

  // Register the routes
  insertAfterMarker(indexPath, ROUTE_IMPORTS, registration.importStatement);
  insertAfterMarker(indexPath, ROUTE_MIDDLEWARE, registration.middlewareStatement);

  // Projects generated by older versions don't have zod yet
  const added = addDependencies(packageJson, MODULE_DEPENDENCIES);
  let installed = true;
  if (added.length > 0) {
    writePackageJson(projectPath, packageJson);
    installed = options.skipInstall ? false : installDependencies(projectPath);
  }

  console.log(
    messages.instructions.moduleEndpoints(moduleName, {
      created,
      fields,
      addedPackages: added,
      installed,
    })
  );
}

module.exports = { addModule };
