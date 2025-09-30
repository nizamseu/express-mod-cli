const messages = require("../utils/messages");
const { createProject } = require("./createProject");
const { addModule } = require("./addModule");

/**
 * Handle CLI commands and route them to appropriate handlers
 * @param {string} command - The command to execute
 * @param {string} name - The name argument for the command
 */
function handleCommand(command, name) {
  console.log(messages.info.command(command));
  console.log(messages.info.name(name));

  switch (command) {
    case "create":
      if (!name) {
        console.error(messages.error.noProjectName);
        process.exit(1);
      }
      createProject(name);
      break;

    case "add":
      if (!name) {
        console.error(messages.error.noModuleName);
        process.exit(1);
      }
      addModule(name);
      break;

    default:
      console.error(messages.error.unknownCommand(command));
      showHelp();
      process.exit(1);
  }
}

/**
 * Display help information
 */
function showHelp() {
  console.log(`
Usage: express-mod-cli <command> <name>

Commands:
  create <project-name>   Create a new Express project with modular architecture
  add <module-name>       Add a new module to the current project

Examples:
  express-mod-cli create my-app      # Create a new project called 'my-app'
  express-mod-cli add users          # Add a 'users' module to current project

Options:
  -h, --help             Show this help message
  -v, --version          Show version number
`);
}

/**
 * Validate command arguments
 * @param {Array} args - Command line arguments
 * @returns {Object} - Parsed command and name
 */
function validateArgs(args) {
  const command = args[0];
  const name = args[1];

  if (!command || command === "-h" || command === "--help") {
    showHelp();
    process.exit(0);
  }

  if (command === "-v" || command === "--version") {
    const packageJson = require("../../package.json");
    console.log(packageJson.version);
    process.exit(0);
  }

  return { command, name };
}

module.exports = {
  handleCommand,
  validateArgs,
  showHelp,
};
