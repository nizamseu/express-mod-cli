const path = require("path");
const fs = require("fs");
const {
  createFile,
  isExpressProject,
  updateFileContent,
} = require("../utils/fileUtils");
const messages = require("../utils/messages");
const {
  generateModelContent,
  generateControllerContent,
  generateRouteContent,
} = require("../templates/moduleTemplates");

/**
 * Add a new module to an existing Express project
 * @param {string} moduleName - The name of the module to add
 */
function addModule(moduleName) {
  const projectPath = process.cwd();

  // Check if we're in a valid Express project
  if (!isExpressProject(projectPath)) {
    console.error(messages.error.notInProject);
    process.exit(1);
  }

  console.log(messages.info.adding(moduleName));

  // Create module directory structure
  const moduleDir = path.join(projectPath, "src", "modules", moduleName);

  try {
    createModuleFiles(moduleDir, moduleName);
    updateMainServer(projectPath, moduleName);

    console.log(messages.instructions.moduleEndpoints(moduleName));
  } catch (error) {
    console.error("Failed to create module:", error.message);
    process.exit(1);
  }
}

/**
 * Create all files for a new module
 * @param {string} moduleDir - The directory where the module should be created
 * @param {string} moduleName - The name of the module
 */
function createModuleFiles(moduleDir, moduleName) {
  // Create module directory
  fs.mkdirSync(moduleDir, { recursive: true });

  // Create model file (Mongoose schema)
  createFile(
    path.join(moduleDir, `${moduleName}.model.js`),
    generateModelContent(moduleName)
  );

  // Create controller file
  createFile(
    path.join(moduleDir, `${moduleName}.controller.js`),
    generateControllerContent(moduleName)
  );

  // Create routes file
  createFile(
    path.join(moduleDir, `${moduleName}.routes.js`),
    generateRouteContent(moduleName)
  );
}

/**
 * Update the main server file to include the new module routes
 * @param {string} projectPath - The project root path
 * @param {string} moduleName - The name of the module to add
 */
function updateMainServer(projectPath, moduleName) {
  const indexPath = path.join(projectPath, "src", "index.js");

  // Add route import
  const importStatement = `const ${moduleName}Routes = require('./modules/${moduleName}/${moduleName}.routes');`;
  updateFileContent(indexPath, "// ROUTE_IMPORTS", importStatement);

  // Add route middleware
  const middlewareStatement = `app.use('/${moduleName}', ${moduleName}Routes);`;
  updateFileContent(indexPath, "// ROUTE_MIDDLEWARE", middlewareStatement);
}

module.exports = { addModule };
