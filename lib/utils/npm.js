const { execSync } = require("child_process");
const messages = require("./messages");

/**
 * Run "npm install" in a project directory.
 * A failed install is reported but not fatal: the generated files are complete
 * and the user can re-run the install themselves.
 * @param {string} projectPath - The project root
 * @returns {boolean} - Whether the install succeeded
 */
function installDependencies(projectPath) {
  console.log(messages.info.installing);

  try {
    execSync("npm install", { cwd: projectPath, stdio: "inherit" });
    return true;
  } catch (error) {
    console.error(messages.warning.installFailed(error.message));
    process.exitCode = 1;
    return false;
  }
}

module.exports = { installDependencies };
