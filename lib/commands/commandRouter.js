const { parseArgs } = require("node:util");
const messages = require("../utils/messages");
const { CliError } = require("../utils/errors");
const { createProject } = require("./createProject");
const { addModule } = require("./addModule");

const OPTIONS = {
  help: { type: "boolean", short: "h" },
  version: { type: "boolean", short: "v" },
  db: { type: "string" },
  ts: { type: "boolean" },
  typescript: { type: "boolean" },
  js: { type: "boolean" },
  javascript: { type: "boolean" },
  "skip-install": { type: "boolean" },
};

/**
 * Display help information
 */
function showHelp() {
  console.log(messages.help);
}

/**
 * Parse command line arguments
 * @param {string[]} args - Command line arguments (without node and script path)
 * @returns {{command: string, name: string, extra: string[], flags: object}}
 */
function parseCommandLine(args) {
  let parsed;
  try {
    parsed = parseArgs({ args, options: OPTIONS, allowPositionals: true });
  } catch (error) {
    // Unknown option, or an option that is missing its value
    throw new CliError(`${error.message}\nRun "express-mod-cli --help" to see the available options.`);
  }

  const [command, name, ...extra] = parsed.positionals;
  return { command, name, extra, flags: parsed.values };
}

/**
 * Parse the arguments and run the matching command
 * @param {string[]} args - Command line arguments (without node and script path)
 */
function run(args) {
  const { command, name, extra, flags } = parseCommandLine(args);

  if (flags.help) {
    showHelp();
    return;
  }

  if (flags.version) {
    console.log(require("../../package.json").version);
    return;
  }

  if (!command) {
    throw new CliError(`${messages.error.noCommand}\n${messages.help}`);
  }

  if (extra.length > 0) {
    throw new CliError(messages.error.tooManyArguments(extra[0]));
  }

  switch (command) {
    case "create": {
      if (!name) throw new CliError(messages.error.noProjectName);

      const wantsTs = flags.ts || flags.typescript;
      const wantsJs = flags.js || flags.javascript;
      if (wantsTs && wantsJs) {
        throw new CliError(messages.error.conflictingLanguage);
      }

      createProject(name, {
        language: wantsTs ? "ts" : "js",
        dbType: flags.db,
        skipInstall: flags["skip-install"],
      });
      break;
    }

    case "add":
      if (!name) throw new CliError(messages.error.noModuleName);
      addModule(name);
      break;

    default:
      throw new CliError(
        `${messages.error.unknownCommand(command)}\n${messages.help}`
      );
  }
}

module.exports = { run, parseCommandLine, showHelp };
