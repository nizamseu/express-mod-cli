const path = require("path");
const { createFile } = require("../utils/fileUtils");
const { CliError } = require("../utils/errors");
const { validateMigrationName } = require("../utils/names");
const { DB_TYPES, loadProject } = require("../utils/projectConfig");
const { supportsMigrations } = require("../utils/projectSupport");
const messages = require("../utils/messages");
const {
  migrationPath,
  generateEmptyMigration,
} = require("../templates/migrationTemplates");

/**
 * Create an empty migration for a SQL connection, for schema changes written by hand
 * (adding a column, an index, ...).
 * @param {string} name - What the migration does (add-phone-to-users)
 * @param {object} [options]
 * @param {string} [options.connection] - SQL connection it belongs to (default: default)
 */
function addMigration(name, options = {}) {
  const projectPath = process.cwd();
  const project = loadProject(projectPath);

  if (!project) {
    throw new CliError(messages.error.notInProject);
  }

  validateMigrationName(name);

  const connection = options.connection || "default";
  const config = project.databases[connection];
  if (!config) {
    throw new CliError(
      messages.error.unknownConnection(connection, Object.keys(project.databases))
    );
  }
  if (DB_TYPES[config.type].driver !== "sql") {
    throw new CliError(messages.error.notSqlConnection(connection));
  }

  const { language } = project;
  if (!supportsMigrations(projectPath, language)) {
    throw new CliError(messages.error.noMigrationSupport);
  }

  const filePath = migrationPath(
    projectPath,
    connection,
    name.toLowerCase().replace(/_/g, "-"),
    language
  );
  createFile(filePath, generateEmptyMigration(language));

  console.log(messages.instructions.migrationAdded(path.relative(projectPath, filePath)));
}

module.exports = { addMigration };
