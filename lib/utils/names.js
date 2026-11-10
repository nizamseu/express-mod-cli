const { CliError } = require("./errors");

// Letters/digits, with single "-" or "_" separators: users, user-profile, order_items
const MODULE_NAME = /^[a-zA-Z][a-zA-Z0-9]*(?:[-_][a-zA-Z0-9]+)*$/;
// A plain directory name (no path separators, no leading dot or dash)
const PROJECT_NAME = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;
// Used as an object key and in env variable names: analytics, salesDb, sales_db
const CONNECTION_NAME = /^[a-zA-Z][a-zA-Z0-9_]*$/;

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

/** user-profile -> user_profile (SQL table names) */
const toSnakeCase = (name) => name.replace(/-/g, "_").toLowerCase();

/** salesDb -> SALES_DB (env variable names) */
const toEnvKey = (name) =>
  name
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/-/g, "_")
    .toUpperCase();

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

module.exports = {
  toCamelCase,
  toPascalCase,
  toSnakeCase,
  toEnvKey,
  validateModuleName,
  validateProjectName,
  validateConnectionName,
};
