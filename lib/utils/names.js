const pluralize = require("pluralize");
const { CliError } = require("./errors");

// Letters/digits, with single "-" or "_" separators: users, user-profile, order_items
const MODULE_NAME = /^[a-zA-Z][a-zA-Z0-9]*(?:[-_][a-zA-Z0-9]+)*$/;
// A plain directory name (no path separators, no leading dot or dash)
const PROJECT_NAME = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;
// Used as an object key and in env variable names: analytics, salesDb, sales_db
const CONNECTION_NAME = /^[a-zA-Z][a-zA-Z0-9_]*$/;
// Part of a migration file name: add-phone-to-users
const MIGRATION_NAME = /^[a-zA-Z0-9]+(?:[-_][a-zA-Z0-9]+)*$/;

const upperFirst = (word) => word.charAt(0).toUpperCase() + word.slice(1);
const lowerFirst = (word) => word.charAt(0).toLowerCase() + word.slice(1);
const segments = (name) => name.split(/[-_]+/).filter(Boolean);

/** user-profile -> userProfile */
const toCamelCase = (name) =>
  segments(name)
    .map((word, index) => (index === 0 ? lowerFirst(word) : upperFirst(word)))
    .join("");

/** user-profile -> UserProfile */
const toPascalCase = (name) => segments(name).map(upperFirst).join("");

/** user-profile, userProfile -> user_profile */
const toSnakeCase = (name) =>
  name
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/-/g, "_")
    .toLowerCase();

/** salesDb -> SALES_DB (env variable names) */
const toEnvKey = (name) => toSnakeCase(name).toUpperCase();

/** order_items -> "Order items" (used in response messages) */
const toLabel = (name) => upperFirst(toSnakeCase(name).replace(/_/g, " "));

/**
 * Every name a module needs, derived from what the user typed.
 * The typed name is kept for files and URLs; code uses singular / plural forms:
 *
 *   order-items -> model "OrderItem", table "order_items",
 *                  "Order item created", "Order items retrieved"
 *
 * @param {string} name - Module name as typed (users, user-profile, order_items)
 */
function moduleNames(name) {
  const words = segments(name);
  const last = words[words.length - 1];
  const head = words.slice(0, -1);

  // Only the last word carries the number: order-items -> order-item
  const singular = [...head, pluralize.singular(last)].join("_");
  const plural = [...head, pluralize.plural(last)].join("_");
  const singularPascal = toPascalCase(singular);

  return {
    /** Identifier prefix for routes / controller, as typed: usersRoutes */
    camel: toCamelCase(name),
    /** Model name: User */
    singularPascal,
    /** Schema variable prefix: userSchema */
    singularCamel: lowerFirst(singularPascal),
    // The "Model" suffix keeps the variable from shadowing globals (Object, Promise, ...)
    model: `${singularPascal}Model`,
    /** SQL table name: users, order_items */
    table: toSnakeCase(plural),
    /** "User" / "Order item" */
    singularLabel: toLabel(singular),
    /** "Users" / "Order items" */
    pluralLabel: toLabel(plural),
  };
}

function validateModuleName(name) {
  if (!MODULE_NAME.test(name)) {
    throw new CliError(
      `Invalid module name "${name}". Use letters and numbers, optionally separated by "-" or "_" (e.g. users, user-profile).`
    );
  }
}

function validateProjectName(name) {
  if (!PROJECT_NAME.test(name)) {
    throw new CliError(
      `Invalid project name "${name}". Use letters, numbers, ".", "-" and "_" only (e.g. my-app).`
    );
  }
}

function validateConnectionName(name) {
  if (!CONNECTION_NAME.test(name)) {
    throw new CliError(
      `Invalid database connection name "${name}". Use letters, numbers and "_" only, starting with a letter (e.g. analytics).`
    );
  }
}

function validateMigrationName(name) {
  if (!MIGRATION_NAME.test(name)) {
    throw new CliError(
      `Invalid migration name "${name}". Use letters and numbers separated by "-" or "_" (e.g. add-phone-to-users).`
    );
  }
}

module.exports = {
  toCamelCase,
  toPascalCase,
  toSnakeCase,
  toEnvKey,
  moduleNames,
  validateModuleName,
  validateProjectName,
  validateConnectionName,
  validateMigrationName,
};
