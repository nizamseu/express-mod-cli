const { execSync } = require("child_process");
const path = require("path");
const { createFile, directoryExists } = require("../utils/fileUtils");
const messages = require("../utils/messages");
const {
  generatePackageJson,
  generateServerContent,
  generateDbConfig,
  generateErrorHandler,
  generateEnvFile,
  generateGitignore,
} = require("../templates/projectTemplates");

/**
 * Create a new Express project with modular architecture
 * @param {string} projectName - The name of the project to create
 */
function createProject(projectName) {
  const projectPath = path.join(process.cwd(), projectName);

  // Check if directory already exists
  if (directoryExists(projectPath)) {
    console.error(messages.error.directoryExists(projectName));
    process.exit(1);
  }

  console.log(messages.info.creating(projectPath));

  // Create project directory structure
  createProjectStructure(projectPath);

  // Create package.json
  const packageJson = generatePackageJson(projectName);
  createFile(
    path.join(projectPath, "package.json"),
    JSON.stringify(packageJson, null, 2)
  );

  // Install dependencies
  console.log(messages.info.installing);
  try {
    execSync("npm install", { cwd: projectPath, stdio: "inherit" });
  } catch (error) {
    console.error("Failed to install dependencies:", error.message);
    process.exit(1);
  }

  // Create project files
  createProjectFiles(projectPath, projectName);

  // Display success message
  console.log(messages.instructions.getStarted(projectName));
}

/**
 * Create the basic directory structure for the project
 * @param {string} projectPath - The path where the project is created
 */
function createProjectStructure(projectPath) {
  const srcPath = path.join(projectPath, "src");

  // Create main directories
  createFile(path.join(projectPath, ".gitkeep"), ""); // Ensure directory exists
  createFile(path.join(srcPath, "config", ".gitkeep"), "");
  createFile(path.join(srcPath, "middleware", ".gitkeep"), "");
  createFile(path.join(srcPath, "modules", ".gitkeep"), "");
  createFile(path.join(srcPath, "utils", ".gitkeep"), "");
}

/**
 * Create all the project files with their content
 * @param {string} projectPath - The path where the project is created
 * @param {string} projectName - The name of the project
 */
function createProjectFiles(projectPath, projectName) {
  const srcPath = path.join(projectPath, "src");

  // Create main server file
  createFile(path.join(srcPath, "index.js"), generateServerContent());

  // Create database configuration
  createFile(path.join(srcPath, "config", "db.js"), generateDbConfig());

  // Create error handler middleware
  createFile(
    path.join(srcPath, "middleware", "errorHandler.js"),
    generateErrorHandler()
  );

  // Create environment file
  createFile(path.join(projectPath, ".env"), generateEnvFile(projectName));

  // Create .gitignore
  createFile(path.join(projectPath, ".gitignore"), generateGitignore());

  // Clean up .gitkeep files
  const gitkeepFiles = [
    path.join(srcPath, "config", ".gitkeep"),
    path.join(srcPath, "middleware", ".gitkeep"),
    path.join(srcPath, "modules", ".gitkeep"),
    path.join(srcPath, "utils", ".gitkeep"),
  ];

  gitkeepFiles.forEach((file) => {
    if (require("fs").existsSync(file)) {
      require("fs").unlinkSync(file);
    }
  });
}

module.exports = { createProject };
