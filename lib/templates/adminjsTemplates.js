const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { readStatic } = require("./static");
const { migrationFile } = require("./migrationTemplates");
const { moduleNames } = require("../utils/names");
const { DB_TYPES } = require("../utils/projectConfig");
const { FILE_TYPES } = require("../utils/fields");

/** Packages every admin panel needs */
const ADMIN_DEPENDENCIES = {
  adminjs: "^7.8.17",
  "@adminjs/express": "^6.1.1",
  "@adminjs/themes": "^1.0.1",
  "express-formidable": "^1.2.0",
  "express-session": "^1.18.2",
  tslib: "^2.8.1",
};

/** The AdminJS adapter of each kind of database (driver) */
const ADMIN_ADAPTERS = {
  mongodb: { "@adminjs/mongoose": "^4.1.0" },
  sql: { "@adminjs/sequelize": "^4.1.1" },
};

/** Where login sessions are stored, by the driver of the users' connection */
const SESSION_STORES = {
  mongodb: { "connect-mongo": "^5.1.0" },
  sql: { "connect-session-sequelize": "^7.1.7" },
};

/** Upload boxes for file and image fields (added with the first such field) */
const ADMIN_UPLOAD_DEPENDENCIES = {
  "@adminjs/upload": "^4.0.2",
};

const ADMIN_TYPE_DEPENDENCIES = {
  "@types/express-session": "^1.18.1",
};

const THEMES = ["light", "dark", "noSidebar"];

/** npm script that creates an admin user */
const adminScripts = (language) => ({
  "admin:create": language === "ts" ? "tsx src/scripts/create-admin.ts" : "node src/scripts/create-admin.js",
});

/**
 * Files add-admin writes, as [path relative to the project, content]
 * @param {object} options
 * @param {"js"|"ts"} options.language
 * @param {string} options.adminPath - Web path of the panel (/admin)
 * @param {string} options.role - Role that may log in
 * @param {string} options.connection - Connection that stores the users
 * @param {string} options.theme - Default theme
 * @param {"mongodb"|"sql"} options.driver - Driver of the users' connection (admin log model)
 */
function adminFiles({ language, adminPath, role, connection, theme, driver }) {
  const read = (name) =>
    readStatic(`admin/${name}`, language)
      .replace(/__ADMIN_PATH__/g, adminPath)
      .replace(/__ADMIN_ROLE__/g, role)
      .replace(/__AUTH_CONNECTION__/g, connection)
      .replace(/__ADMIN_THEME__/g, theme);
  const ext = language;

  // The React components are the same for JavaScript and TypeScript projects
  const component = (name) => [
    `src/admin/components/${name}.jsx`,
    fs.readFileSync(path.join(__dirname, "static", "admin", "components", `${name}.jsx`), "utf-8"),
  ];

  return [
    [`src/admin/admin.config.${ext}`, read("admin.config")],
    [`src/admin/router.${ext}`, read("router")],
    [`src/admin/index.${ext}`, read("index")],
    [`src/admin/resources.${ext}`, read("resources")],
    [`src/admin/authenticate.${ext}`, read("authenticate")],
    [`src/admin/session.${ext}`, read("session")],
    [`src/admin/zodHooks.${ext}`, read("zodHooks")],
    [`src/admin/users.resource.${ext}`, read("users.resource")],
    [`src/admin/defaultAdmin.${ext}`, read("defaultAdmin")],
    [`src/admin/translations.${ext}`, read("translations")],
    [`src/admin/permissions.${ext}`, read("permissions")],
    [`src/admin/adminLog.${ext}`, read(`adminLog.${driver}`)],
    [`src/admin/auditLog.${ext}`, read("auditLog")],
    [`src/admin/importExport.${ext}`, read("importExport")],
    [`src/admin/uploads.${ext}`, read("uploads")],
    [`src/admin/passwordReset.${ext}`, read("passwordReset")],
    [`src/admin/theme.${ext}`, read("theme")],
    component("Dashboard"),
    component("Login"),
    component("LoggedIn"),
    component("Export"),
    component("Import"),
    [`src/scripts/create-admin.${ext}`, read("create-admin")],
  ];
}

/** tests/admin.test - form validation checks that need no database */
const adminTest = (language) => readStatic("admin/tests", language);

/** The tables of the admin panel (SQL projects): login sessions and the admin log */
const adminTablesMigration = (language) =>
  migrationFile(language, {
    imports: ["DataTypes"],
    up: `  // Admin logins (connect-session-sequelize)
  await queryInterface.createTable('admin_sessions', {
    sid: { type: DataTypes.STRING(36), primaryKey: true },
    expires: { type: DataTypes.DATE },
    data: { type: DataTypes.TEXT },
    createdAt: { type: DataTypes.DATE, allowNull: false },
    updatedAt: { type: DataTypes.DATE, allowNull: false }
  });

  // Who added, changed, deleted or imported what
  await queryInterface.createTable('admin_logs', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    action: { type: DataTypes.STRING, allowNull: false },
    resource: { type: DataTypes.STRING, allowNull: false },
    recordId: { type: DataTypes.STRING },
    recordTitle: { type: DataTypes.STRING },
    changes: { type: DataTypes.TEXT },
    userId: { type: DataTypes.STRING, allowNull: false },
    userEmail: { type: DataTypes.STRING, allowNull: false },
    createdAt: { type: DataTypes.DATE, allowNull: false }
  });
  await queryInterface.addIndex('admin_logs', ['createdAt']);`,
    down: `  await queryInterface.dropTable('admin_logs');
  await queryInterface.dropTable('admin_sessions');`,
  });

/** Sidebar group of a module: its database connection, when the project has several */
const navigationGroup = (connection) =>
  connection === "default" ? "Modules" : connection.charAt(0).toUpperCase() + connection.slice(1);

const list = (items) => `[${items.map((item) => `'${item}'`).join(", ")}]`;

/**
 * src/modules/<name>/<name>.admin - how the module looks in the admin panel
 * @param {object} options
 * @param {string} options.name - Module name
 * @param {"js"|"ts"} options.language
 * @param {string} options.dbType - Database type of the module's connection
 * @param {string} options.connection - The module's connection
 * @param {import("../utils/fields").Field[]|null} options.fields - null for modules created
 *   before the admin panel: AdminJS then reads every field from the model
 * @param {boolean} [options.validation] - The module has a <name>.validation file (Zod schemas)
 */
function generateModuleAdminContent({ name, language, dbType, connection, fields, validation = true }) {
  const { model, singularPascal } = moduleNames(name);
  const ts = language === "ts";
  const idField = DB_TYPES[dbType].driver === "mongodb" ? "_id" : "id";
  const createSchema = `create${singularPascal}Schema`;
  const updateSchema = `update${singularPascal}Schema`;

  const options = [`navigation: { name: '${navigationGroup(connection)}', icon: 'Database' },`];
  const uploads = (fields || []).filter((field) => FILE_TYPES.includes(field.type));

  if (fields) {
    // A file field shows its upload box (<field>File) instead of the stored path
    const shown = fields.map((field) => (FILE_TYPES.includes(field.type) ? `${field.name}File` : field.name));
    const filterable = fields.filter((field) => !FILE_TYPES.includes(field.type)).map((field) => field.name);
    const properties = fields
      .filter((field) => field.type === "text" || field.type === "date")
      .map((field) => `      ${field.name}: { type: '${field.type === "text" ? "textarea" : "date"}' },`);

    options.push(
      `listProperties: ${list([...shown.slice(0, 4), "createdAt"])},`,
      `filterProperties: ${list([...filterable, "createdAt"])},`,
      `showProperties: ${list([idField, ...shown, "createdAt", "updatedAt"])},`,
      `editProperties: ${list(shown)},`,
      `sort: { sortBy: 'createdAt', direction: 'desc' },`
    );
    if (properties.length > 0) {
      options.push(`properties: {\n${properties.join("\n")}\n    },`);
    }
  }

  if (validation) {
    options.push(`// The same rules as the API (${name}.validation)
    actions: {
      new: { before: [zodHooks(${createSchema})] },
      edit: { before: [zodHooks(${updateSchema})] },
    },`);
  }

  const doc = `/**
 * The ${name} module in the admin panel (src/admin).
 * Options: https://docs.adminjs.co/basics/resource
 */`;
  const features = uploads.length
    ? `
  // Upload boxes; the files are kept in uploads/ and served at /uploads
  features: [${uploads
    .map((field) => `uploadFile('${field.name}'${field.type === "image" ? ", { images: true }" : ""})`)
    .join(", ")}],`
    : "";
  const body = `({
  resource: ${model},
  options: {
    ${options.join("\n    ")}
  },${features}
})`;
  const used = [...(validation ? ["zodHooks"] : []), ...(uploads.length ? ["uploadFile"] : [])];
  const param = used.length ? `{ ${used.join(", ")} }` : "_helpers";

  if (ts) {
    const imports = [
      `import type { ResourceWithOptions } from 'adminjs' with { 'resolution-mode': 'import' };`,
      `import ${model} from './${name}.model';`,
      ...(validation ? [`import { ${createSchema}, ${updateSchema} } from './${name}.validation';`] : []),
      `import type { AdminHelpers } from '../../admin/zodHooks';`,
    ];
    const type = "AdminHelpers";
    return `
${imports.join("\n")}

${doc}
export default (${param}: ${type}): ResourceWithOptions => ${body};
`;
  }

  const imports = [
    `const ${model} = require('./${name}.model');`,
    ...(validation ? [`const { ${createSchema}, ${updateSchema} } = require('./${name}.validation');`] : []),
  ];
  return `
${imports.join("\n")}

${doc}
module.exports = (${param}) => ${body};
`;
}

/** Statements that register a module in src/admin/resources */
function moduleAdminRegistration(moduleName, language) {
  const identifier = `${moduleNames(moduleName).camel}Admin`;
  const modulePath = `../modules/${moduleName}/${moduleName}.admin`;

  return {
    identifier,
    importStatement:
      language === "ts"
        ? `import ${identifier} from '${modulePath}';`
        : `const ${identifier} = require('${modulePath}');`,
    resourceStatement: `${identifier}(helpers),`,
  };
}

/**
 * Env variables of the admin panel
 * @param {{ example: boolean, theme: string, email: string, password: string }} options
 */
const adminEnv = ({ example, theme, email, password }) => `
# Admin panel (express-mod-cli add-admin)
# Signs the admin login cookie - keep it secret, at least 32 random characters
ADMIN_COOKIE_SECRET=${example ? "change-me-to-a-long-random-string-of-at-least-32-characters" : crypto.randomBytes(48).toString("base64url")}
ADMIN_TITLE="express-mod-cli admin"
# light, dark or noSidebar
ADMIN_THEME=${theme}
# en or bn
ADMIN_LANGUAGE=en
ADMIN_SESSION_HOURS=8
# Address of this server, for the links in password reset emails (default: http://localhost:<PORT>)
# ADMIN_URL=https://api.example.com
# Largest file (MB) for file and image fields
ADMIN_UPLOAD_MAX_MB=10
# The first admin, created on startup while the database has no admin.
# Change the password after the first login; more admins: npm run admin:create -- <email>
ADMIN_EMAIL=${email}
ADMIN_PASSWORD=${example ? "change-me" : password}
`;

module.exports = {
  ADMIN_DEPENDENCIES,
  ADMIN_ADAPTERS,
  SESSION_STORES,
  ADMIN_TYPE_DEPENDENCIES,
  ADMIN_UPLOAD_DEPENDENCIES,
  THEMES,
  adminScripts,
  adminFiles,
  adminTest,
  adminTablesMigration,
  generateModuleAdminContent,
  moduleAdminRegistration,
  adminEnv,
};
