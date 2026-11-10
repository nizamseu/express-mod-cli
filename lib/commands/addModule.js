const path = require("path");
const fs = require("fs");
const { createFile, assertMarkers, insertAfterMarker } = require("../utils/fileUtils");
const { CliError } = require("../utils/errors");
const { validateModuleName } = require("../utils/names");
const { loadProject } = require("../utils/projectConfig");
const messages = require("../utils/messages");
const {
  generateModelContent,
  generateControllerContent,
  generateRouteContent,
  routeRegistration,
} = require("../templates/moduleTemplates");

const ROUTE_IMPORTS = "// ROUTE_IMPORTS";
const ROUTE_MIDDLEWARE = "// ROUTE_MIDDLEWARE";

/**
 * Add a new module to an existing Express project
 * @param {string} moduleName - The name of the module to add
 * @param {object} [options]
 * @param {string} [options.connection] - Database connection the module uses (default: default)
 */
function addModule(moduleName, options = {}) {
  const projectPath = process.cwd();
  const project = loadProject(projectPath);

  if (!project) {
    throw new CliError(messages.error.notInProject);
  }

  validateModuleName(moduleName);

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
  const indexPath = path.join(projectPath, "src", `index.${language}`);
  const moduleDir = path.join(projectPath, "src", "modules", moduleName);
  const registration = routeRegistration(moduleName, language);

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

  console.log(messages.info.adding(moduleName, connection));

  const templateOptions = {
    name: moduleName,
    language,
    connection,
    dbType: project.databases[connection].type,
    legacy: project.legacy,
  };

  createFile(
    path.join(moduleDir, `${moduleName}.model.${language}`),
    generateModelContent(templateOptions)
  );
  createFile(
    path.join(moduleDir, `${moduleName}.controller.${language}`),
    generateControllerContent(templateOptions)
  );
  createFile(
    path.join(moduleDir, `${moduleName}.routes.${language}`),
    generateRouteContent(templateOptions)
  );

  // Register the routes in the main server file
  insertAfterMarker(indexPath, ROUTE_IMPORTS, registration.importStatement);
  insertAfterMarker(indexPath, ROUTE_MIDDLEWARE, registration.middlewareStatement);

  console.log(messages.instructions.moduleEndpoints(moduleName, language));
}

module.exports = { addModule };
