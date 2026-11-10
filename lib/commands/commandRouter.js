const { parseArgs } = require("node:util");
const messages = require("../utils/messages");
const { CliError } = require("../utils/errors");
const { normalizeDbType } = require("../utils/projectConfig");
const { createProject } = require("./createProject");
const { addModule } = require("./addModule");
const { addDatabase } = require("./addDatabase");
const { addMigration } = require("./addMigration");

const OPTIONS = {
  help: { type: "boolean", short: "h" },
  version: { type: "boolean", short: "v" },
  db: { type: "string" },
  type: { type: "string" },
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

async function runCreate(name, flags) {
  const wantsTs = flags.ts || flags.typescript;
  const wantsJs = flags.js || flags.javascript;
  if (wantsTs && wantsJs) {
    throw new CliError(messages.error.conflictingLanguage);
  }

  const options = {
    name,
    language: wantsTs ? "ts" : wantsJs ? "js" : undefined,
    // Validate before asking anything
    dbType: flags.db ? normalizeDbType(flags.db) : undefined,
  };

  if (!options.name) throw new CliError(messages.error.noProjectName);

  createProject(options.name, {
    language: options.language,
    dbType: options.dbType,
    skipInstall: flags["skip-install"],
  });
}

/**
 * Parse the arguments and run the matching command
 * @param {string[]} args - Command line arguments (without node and script path)
 */
async function run(args) {
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

  // Only "add" takes more than one name (its fields)
  if (extra.length > 0 && command !== "add") {
    throw new CliError(messages.error.tooManyArguments(extra[0]));
  }

  switch (command) {
    case "create":
      await runCreate(name, flags);
      break;

    case "add":
      if (!name) throw new CliError(messages.error.noModuleName);
      addModule(name, {
        fields: extra,
        connection: flags.db,
        skipInstall: flags["skip-install"],
      });
      break;

    case "add-db":
      if (!name) throw new CliError(messages.error.noConnectionName);
      addDatabase(name, {
        dbType: flags.type,
        skipInstall: flags["skip-install"],
      });
      break;

    case "add-migration":
      if (!name) throw new CliError(messages.error.noMigrationName);
      addMigration(name, { connection: flags.db });
      break;

    default:
      throw new CliError(
        `${messages.error.unknownCommand(command)}\n${messages.help}`
      );
  }
}

module.exports = { run, parseCommandLine, showHelp };
