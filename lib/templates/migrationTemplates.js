const fs = require("fs");
const path = require("path");
const { moduleNames } = require("../utils/names");
const { sequelizeAttributes } = require("./fieldTemplates");

const formatTimestamp = (date) => date.toISOString().replace(/\D/g, "").slice(0, 14);

/**
 * Path of a new migration file: src/migrations/<connection>/20260131094500-<slug>.<ext>
 *
 * Migrations run in file name order, so the timestamp prefix decides the order.
 * It is always later than the newest existing migration, even when several are
 * created within the same second.
 * @param {string} projectPath - The project root
 * @param {string} connection - SQL connection the migration belongs to
 * @param {string} slug - What the migration does (create-products)
 * @param {"js"|"ts"} language - Project language
 */
function migrationPath(projectPath, connection, slug, language) {
  const directory = path.join(projectPath, "src", "migrations", connection);
  const latest = fs.existsSync(directory)
    ? fs.readdirSync(directory)
        .map((file) => file.match(/^(\d{14})-/)?.[1])
        .filter(Boolean)
        .sort()
        .pop()
    : undefined;

  let date = new Date();
  if (latest && formatTimestamp(date) <= latest) {
    // One second after the latest one (the prefix is UTC: YYYYMMDDHHmmss)
    const [, y, mo, d, h, mi, s] = latest.match(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
    date = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s + 1));
  }

  return path.join(directory, `${formatTimestamp(date)}-${slug}.${language}`);
}

/** Wrap the bodies of up() and down() in a migration file */
const migrationFile = (language, { imports, up, down }) => {
  if (language === "ts") {
    return `
import { ${imports.join(", ")}, type QueryInterface } from 'sequelize';

type MigrationParams = { context: QueryInterface };

export async function up({ context: queryInterface }: MigrationParams): Promise<void> {
${up}
}

export async function down({ context: queryInterface }: MigrationParams): Promise<void> {
${down}
}
`;
  }

  return `
const { ${imports.join(", ")} } = require('sequelize');

/** @param {{ context: import('sequelize').QueryInterface }} params */
async function up({ context: queryInterface }) {
${up}
}

/** @param {{ context: import('sequelize').QueryInterface }} params */
async function down({ context: queryInterface }) {
${down}
}

module.exports = { up, down };
`;
};

/**
 * Generate the migration that creates the table of a new module
 * @param {object} options
 * @param {string} options.name - Module name
 * @param {"js"|"ts"} options.language - Project language
 * @param {import("../utils/fields").Field[]} options.fields - The module's fields
 * @returns {string} - Migration file content
 */
const generateCreateTableMigration = ({ name, language, fields }) => {
  const { table } = moduleNames(name);
  const columns = sequelizeAttributes(fields, {
    migration: true,
    withId: true,
    withTimestamps: true,
    indent: "    ",
  });

  return migrationFile(language, {
    imports: ["DataTypes"],
    up: `  await queryInterface.createTable('${table}', {
${columns}
  });`,
    down: `  await queryInterface.dropTable('${table}');`,
  });
};

/**
 * Generate an empty migration for a schema change the user writes by hand
 * @param {"js"|"ts"} language - Project language
 * @returns {string} - Migration file content
 */
const generateEmptyMigration = (language) =>
  migrationFile(language, {
    imports: ["DataTypes"],
    up: `  // Describe the change, for example:
  // await queryInterface.addColumn('users', 'phone', { type: DataTypes.STRING });`,
    down: `  // Undo it, so "npm run migrate:down" can roll the change back:
  // await queryInterface.removeColumn('users', 'phone');`,
  });

module.exports = {
  migrationPath,
  migrationFile,
  generateCreateTableMigration,
  generateEmptyMigration,
};
