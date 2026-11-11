const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const {
  createFile,
  assertMarkers,
  insertAfterLine,
  insertAfterMarker,
  setEnvBlock,
} = require("../utils/fileUtils");
const { CliError } = require("../utils/errors");
const { DB_TYPES, loadProject, saveProject } = require("../utils/projectConfig");
const { installDependencies } = require("../utils/npm");
const {
  routesFile,
  supportsMigrations,
  supportsTests,
  readPackageJson,
  writePackageJson,
  addDependencies,
} = require("../utils/projectSupport");
const messages = require("../utils/messages");
const { migrationPath } = require("../templates/migrationTemplates");
const {
  ADMIN_DEPENDENCIES,
  ADMIN_ADAPTERS,
  SESSION_STORES,
  ADMIN_TYPE_DEPENDENCIES,
  THEMES,
  adminScripts,
  adminFiles,
  adminTest,
  adminTablesMigration,
  generateModuleAdminContent,
  moduleAdminRegistration,
  adminEnv,
} = require("../templates/adminjsTemplates");

const ADMIN_IMPORTS = "// ADMIN_IMPORTS";
const ADMIN_RESOURCES = "// ADMIN_RESOURCES";
const ADMIN_PATH = /^\/[a-z0-9][a-z0-9_-]*(\/[a-z0-9][a-z0-9_-]*)*$/i;
const ROLE = /^[a-zA-Z][a-zA-Z0-9_-]*$/;
const DEFAULT_ADMIN_EMAIL = "admin@example.com";

/** Lines of src/app and src/index the command adds code below */
const anchors = (language) =>
  language === "ts"
    ? {
        appImport: /^import errorHandler from ['"]\.\/middleware\/errorHandler['"]/,
        appCreate: /^const app = express\(\);/,
        appHelmet: /^app\.use\(helmet\(\)\);/,
        serverImport: /^import app from ['"]\.\/app['"]/,
        serverConnect: /^\s*await connectDB\(\);/,
      }
    : {
        appImport: /^const errorHandler = require\(['"]\.\/middleware\/errorHandler['"]\)/,
        appCreate: /^const app = express\(\);/,
        appHelmet: /^app\.use\(helmet\(\)\);/,
        serverImport: /^const app = require\(['"]\.\/app['"]\)/,
        serverConnect: /^\s*await connectDB\(\);/,
      };

const ROLE_LIST = /(role:\s*{[^}]*?(?:enum:\s*|isIn:\s*\[)\[)([^\]]*)(\])/;
const STAFF_ROLE = "staff";

const userModelFile = (projectPath, language) =>
  path.join(projectPath, "src", "modules", "auth", `user.model.${language}`);

/** The roles the generated User model allows (enum / isIn list), or null if it can't tell */
function userRoles(projectPath, language) {
  const file = userModelFile(projectPath, language);
  if (!fs.existsSync(file)) return null;

  const match = fs.readFileSync(file, "utf-8").match(ROLE_LIST);
  return match ? [...match[2].matchAll(/['"]([^'"]+)['"]/g)].map((value) => value[1]) : null;
}

/** Allow the staff role in the User model; false if the role list wasn't found */
function addStaffRole(projectPath, language) {
  const file = userModelFile(projectPath, language);
  const roles = userRoles(projectPath, language);
  if (!roles) return false;
  if (roles.includes(STAFF_ROLE)) return true;

  const content = fs.readFileSync(file, "utf-8");
  fs.writeFileSync(file, content.replace(ROLE_LIST, (all, start, list, end) => `${start}${list}, '${STAFF_ROLE}'${end}`));
  return true;
}

/**
 * Modules that existed before the admin panel, with what their model file says
 * about their connection. Their fields were never saved, so AdminJS reads them from the model.
 */
function existingModules(projectPath, project, language) {
  const modulesDir = path.join(projectPath, "src", "modules");
  if (!fs.existsSync(modulesDir)) return [];

  return fs
    .readdirSync(modulesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== "auth")
    .map((entry) => {
      const name = entry.name;
      const modelFile = path.join(modulesDir, name, `${name}.model.${language}`);
      if (!fs.existsSync(modelFile)) return null;

      const model = fs.readFileSync(modelFile, "utf-8");
      const connection = model.match(/get(?:Mongo|Sql)Connection\(['"]([^'"]+)['"]\)/)?.[1] || "default";
      const dbType = project.databases[connection]?.type;
      if (!dbType) return null;

      const validation = fs.existsSync(path.join(modulesDir, name, `${name}.validation.${language}`));
      return { name, connection, dbType, validation };
    })
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Add an AdminJS admin panel: login for users with the admin role, every module's
 * records, users and roles, and a first admin user created on startup.
 * @param {object} [options]
 * @param {string} [options.path] - Web path of the panel (default: /admin)
 * @param {string} [options.role] - Role that may log in (default: admin)
 * @param {string} [options.theme] - Default theme (see THEMES in templates/adminjsTemplates)
 * @param {boolean} [options.skipInstall] - Don't run "npm install"
 */
function addAdmin(options = {}) {
  const projectPath = process.cwd();
  const project = loadProject(projectPath);

  if (!project) throw new CliError(messages.error.notInProject);
  if (project.legacy) throw new CliError(messages.error.legacyProject);
  if (!project.auth) throw new CliError(messages.error.adminNeedsAuth);
  if (project.admin) throw new CliError(messages.error.adminExists(project.admin.path));

  const { language } = project;
  const adminPath = (options.path || "/admin").replace(/\/+$/, "") || "/";
  const role = options.role || "admin";
  const theme = options.theme || "classic";
  const connection = project.auth.connection || "default";
  const authDriver = DB_TYPES[project.databases[connection].type].driver;

  // Check everything up front, so nothing is written unless the whole command can succeed
  if (!ADMIN_PATH.test(adminPath)) throw new CliError(messages.error.invalidAdminPath(options.path));
  if (!ROLE.test(role)) throw new CliError(messages.error.invalidRole(role));
  if (role === STAFF_ROLE) throw new CliError(messages.error.adminRoleIsStaff);
  if (!THEMES.includes(theme)) throw new CliError(messages.error.invalidTheme(theme, THEMES));

  const roles = userRoles(projectPath, language);
  if (roles && !roles.includes(role)) {
    throw new CliError(messages.error.adminRoleNotInModel(role, roles, `src/modules/auth/user.model.${language}`));
  }

  const modules = existingModules(projectPath, project, language);
  const firstSegment = adminPath.split("/")[1];
  if (firstSegment === "auth" || modules.some((module) => module.name === firstSegment)) {
    throw new CliError(messages.error.adminPathTaken(adminPath));
  }

  const appPath = routesFile(projectPath, language);
  const serverPath = path.join(projectPath, "src", `index.${language}`);
  const anchor = anchors(language);
  for (const [file, patterns] of [
    [appPath, [anchor.appImport, anchor.appCreate, anchor.appHelmet]],
    [serverPath, [anchor.serverImport, anchor.serverConnect]],
  ]) {
    const relative = path.relative(projectPath, file);
    if (!fs.existsSync(file)) throw new CliError(`Cannot find ${relative}.`);
    const lines = fs.readFileSync(file, "utf-8").split("\n");
    const missing = patterns.find((pattern) => !lines.some((line) => pattern.test(line)));
    if (missing) throw new CliError(messages.error.adminAnchorMissing(relative, missing));
  }

  const files = adminFiles({ language, adminPath, role, connection, theme, driver: authDriver });
  const moduleFile = (name) => `src/modules/${name}/${name}.admin.${language}`;
  const existingFile = [
    "src/admin",
    ...files.map(([file]) => file),
    ...modules.map((module) => moduleFile(module.name)),
  ].find((file) => fs.existsSync(path.join(projectPath, file)));
  if (existingFile) throw new CliError(messages.error.adminFileExists(existingFile));

  const packageJson = readPackageJson(projectPath);

  console.log(messages.info.addingAdmin(adminPath));

  const created = [];
  const write = (relativePath, content) => {
    createFile(path.join(projectPath, relativePath), content);
    created.push(relativePath);
  };

  // 1. The panel
  for (const [file, content] of files) {
    write(file, content);
  }

  // 2. Every existing module, in src/admin/resources
  const resourcesPath = path.join(projectPath, "src", "admin", `resources.${language}`);
  assertMarkers(resourcesPath, [ADMIN_IMPORTS, ADMIN_RESOURCES]);
  for (const module of [...modules].reverse()) {
    write(moduleFile(module.name), generateModuleAdminContent({ ...module, language, fields: null }));
    const registration = moduleAdminRegistration(module.name, language);
    insertAfterMarker(resourcesPath, ADMIN_IMPORTS, registration.importStatement);
    insertAfterMarker(resourcesPath, ADMIN_RESOURCES, registration.resourceStatement);
  }

  // 3. Login sessions and admin log tables (SQL)
  if (authDriver === "sql" && supportsMigrations(projectPath, language)) {
    const migration = migrationPath(projectPath, connection, "create-admin-tables", language);
    write(path.relative(projectPath, migration), adminTablesMigration(language));
  }

  // 4. The staff role (view, add and edit - no deleting)
  const staffRole = addStaffRole(projectPath, language);

  if (supportsTests(projectPath, language, packageJson)) {
    write(`tests/admin.test.${language}`, adminTest(language));
  }

  // 5. src/app: mount the admin router before helmet and the body parsers, serve uploaded files
  insertAfterLine(
    appPath,
    anchor.appImport,
    language === "ts"
      ? "import adminRouter from './admin/router';\nimport { serveUploads } from './admin/uploads';"
      : "const adminRouter = require('./admin/router');\nconst { serveUploads } = require('./admin/uploads');"
  );
  insertAfterLine(
    appPath,
    anchor.appHelmet,
    "\n// Files uploaded in the admin panel (file and image fields)\napp.use('/uploads', serveUploads());"
  );
  insertAfterLine(
    appPath,
    anchor.appCreate,
    [
      "",
      "// Admin panel (express-mod-cli add-admin). It comes before helmet and the body",
      "// parsers: it sets its own security headers and reads its own form data.",
      `app.use('${adminPath}', adminRouter);`,
    ].join("\n")
  );

  // 6. src/index: start the panel once the databases are connected
  insertAfterLine(
    serverPath,
    anchor.serverImport,
    language === "ts" ? "import { mountAdmin } from './admin';" : "const { mountAdmin } = require('./admin');"
  );
  insertAfterLine(serverPath, anchor.serverConnect, "await mountAdmin();");

  // 7. Settings, with a first admin user
  const adminPassword = crypto.randomBytes(12).toString("base64url");
  const env = { theme, email: DEFAULT_ADMIN_EMAIL, password: adminPassword };
  setEnvBlock(path.join(projectPath, ".env"), adminEnv({ ...env, example: false }));
  setEnvBlock(path.join(projectPath, ".env.example"), adminEnv({ ...env, example: true }));

  // 8. Packages and scripts
  const drivers = new Set(Object.values(project.databases).map((db) => DB_TYPES[db.type].driver));
  const added = [
    ...addDependencies(packageJson, {
      ...ADMIN_DEPENDENCIES,
      ...[...drivers].reduce((all, driver) => ({ ...all, ...ADMIN_ADAPTERS[driver] }), {}),
      ...SESSION_STORES[authDriver],
    }),
    ...(language === "ts" ? addDependencies(packageJson, ADMIN_TYPE_DEPENDENCIES, { dev: true }) : []),
  ];

  // Added after the existing scripts; an existing script with that name is kept
  const existingScripts = packageJson.scripts || {};
  packageJson.scripts = { ...existingScripts, ...adminScripts(language), ...existingScripts };

  // The panel writes its built components to .adminjs/ - nodemon must not restart on that
  if (language === "js") {
    const ignore = packageJson.nodemonConfig?.ignore || [];
    if (!ignore.includes(".adminjs/*")) {
      packageJson.nodemonConfig = { ...packageJson.nodemonConfig, ignore: [...ignore, ".adminjs/*"] };
    }
  }
  writePackageJson(projectPath, packageJson);

  // 9. Built components and uploaded files are not source code
  const gitignorePath = path.join(projectPath, ".gitignore");
  if (fs.existsSync(gitignorePath)) {
    let gitignore = fs.readFileSync(gitignorePath, "utf-8");
    for (const entry of [".adminjs/", "uploads/"]) {
      if (!gitignore.split("\n").includes(entry)) {
        gitignore += `${gitignore.endsWith("\n") ? "" : "\n"}${entry}\n`;
      }
    }
    fs.writeFileSync(gitignorePath, gitignore);
  }

  // 10. Project config: "add" registers new modules in the panel from now on
  project.admin = { path: adminPath, role };
  saveProject(projectPath, project);

  let installed = true;
  if (added.length > 0) {
    installed = options.skipInstall ? false : installDependencies(projectPath);
  }

  console.log(
    messages.instructions.adminAdded({
      created,
      adminPath,
      installed,
      email: DEFAULT_ADMIN_EMAIL,
      password: adminPassword,
      modules: modules.map((module) => module.name),
      staffRole,
    })
  );
}

module.exports = { addAdmin };
