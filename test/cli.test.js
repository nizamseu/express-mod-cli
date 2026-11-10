const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const CLI = path.join(__dirname, "..", "bin", "index.js");

let workDir;

before(() => {
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), "express-mod-cli-"));
});

after(() => {
  fs.rmSync(workDir, { recursive: true, force: true });
});

/** Run the CLI in a directory and capture its result */
function cli(cwd, ...args) {
  const result = spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    encoding: "utf-8",
  });
  return { code: result.status, out: result.stdout, err: result.stderr };
}

/** Create a project (without npm install) and return its path */
function createProject(name, ...flags) {
  const result = cli(workDir, "create", name, "--skip-install", ...flags);
  assert.equal(result.code, 0, result.err);
  return path.join(workDir, name);
}

const read = (...parts) => fs.readFileSync(path.join(...parts), "utf-8");
const exists = (...parts) => fs.existsSync(path.join(...parts));

/** Every generated .js file must at least parse */
function assertValidJs(projectPath) {
  const files = fs
    .readdirSync(path.join(projectPath, "src"), { recursive: true })
    .filter((file) => file.endsWith(".js"));
  assert.ok(files.length > 0);

  for (const file of files) {
    const check = spawnSync(process.execPath, [
      "--check",
      path.join(projectPath, "src", file),
    ]);
    assert.equal(check.status, 0, `${file}: ${check.stderr}`);
  }
}

describe("general", () => {
  test("--version prints the package version", () => {
    const result = cli(workDir, "--version");
    assert.equal(result.code, 0);
    assert.equal(result.out.trim(), require("../package.json").version);
  });

  test("--help works anywhere on the command line and creates nothing", () => {
    for (const args of [["--help"], ["create", "-h"], ["add", "--help"]]) {
      const result = cli(workDir, ...args);
      assert.equal(result.code, 0);
      assert.match(result.out, /Usage: express-mod-cli/);
    }
    assert.deepEqual(fs.readdirSync(workDir), []);
  });

  test("no command, unknown command and unknown option fail", () => {
    assert.equal(cli(workDir).code, 1);
    assert.match(cli(workDir, "remove", "x").err, /Unknown command: remove/);
    assert.match(cli(workDir, "create", "x", "--nope").err, /--nope/);
    assert.equal(exists(workDir, "x"), false);
  });
});

describe("create", () => {
  test("defaults to JavaScript + MongoDB", () => {
    const project = createProject("js-default");

    assert.deepEqual(JSON.parse(read(project, ".expressmodrc.json")), {
      language: "js",
      databases: { default: { type: "mongodb" } },
    });

    const pkg = JSON.parse(read(project, "package.json"));
    assert.ok(pkg.dependencies.mongoose);
    assert.equal(pkg.dependencies.sequelize, undefined);
    assert.equal(pkg.devDependencies.typescript, undefined);
    // Pinned ranges, never "latest"
    for (const range of Object.values({ ...pkg.dependencies, ...pkg.devDependencies })) {
      assert.match(range, /^\^\d/);
    }

    assert.ok(exists(project, "src", "config", "mongodb.js"));
    assert.equal(exists(project, "src", "config", "sql.js"), false);
    assert.equal(exists(project, "tsconfig.json"), false);
    assert.equal(exists(project, ".gitkeep"), false);
    assert.match(read(project, ".env"), /^MONGODB_URI=/m);
    assert.equal(read(project, ".env"), read(project, ".env.example"));
    assertValidJs(project);
  });

  test("--ts --db postgres generates a TypeScript + Sequelize project", () => {
    const project = createProject("ts-pg", "--ts", "--db", "postgres");

    const pkg = JSON.parse(read(project, "package.json"));
    assert.ok(pkg.dependencies.sequelize && pkg.dependencies.pg);
    assert.equal(pkg.dependencies.mongoose, undefined);
    assert.ok(pkg.devDependencies.typescript && pkg.devDependencies.tsx);
    assert.equal(pkg.scripts.build, "tsc");

    for (const file of ["index.ts", "config/sql.ts", "config/env.ts", "config/db.ts"]) {
      assert.ok(exists(project, "src", file), file);
    }
    assert.ok(exists(project, "tsconfig.json"));
    assert.equal(exists(project, "src", "index.js"), false);
    assert.match(read(project, ".env"), /^DATABASE_URL=postgres:\/\//m);
  });

  test("--db mysql adds the mysql2 driver", () => {
    const project = createProject("js-mysql", "--db", "mysql");
    const pkg = JSON.parse(read(project, "package.json"));
    assert.ok(pkg.dependencies.sequelize && pkg.dependencies.mysql2);
    assert.match(read(project, ".env"), /^DATABASE_URL=mysql:\/\//m);
  });

  test("rejects bad input without creating anything", () => {
    assert.match(cli(workDir, "create").err, /project name/);
    assert.match(cli(workDir, "create", "../escape").err, /Invalid project name/);
    assert.match(cli(workDir, "create", "a", "--db", "oracle").err, /Unsupported database/);
    assert.match(cli(workDir, "create", "a", "--ts", "--js").err, /either --ts or --js/);
    assert.equal(exists(workDir, "a"), false);
    assert.equal(exists(workDir, "..", "escape"), false);
  });

  test("refuses to overwrite an existing directory", () => {
    createProject("twice");
    const result = cli(workDir, "create", "twice", "--skip-install");
    assert.equal(result.code, 1);
    assert.match(result.err, /already exists/);
  });
});

describe("add", () => {
  test("generates a module and registers its routes", () => {
    const project = createProject("add-basic");
    assert.equal(cli(project, "add", "users").code, 0);

    const index = read(project, "src", "index.js");
    assert.match(index, /const usersRoutes = require\('\.\/modules\/users\/users\.routes'\);/);
    assert.match(index, /app\.use\('\/users', usersRoutes\);/);
    assert.match(
      read(project, "src", "modules", "users", "users.model.js"),
      /getMongoConnection\('default'\)\.model\('Users'/
    );
    assertValidJs(project);
  });

  test("hyphenated names become valid identifiers", () => {
    const project = createProject("add-hyphen");
    assert.equal(cli(project, "add", "user-profile").code, 0);

    const index = read(project, "src", "index.js");
    assert.match(index, /const userProfileRoutes = require\('\.\/modules\/user-profile\/user-profile\.routes'\);/);
    assert.match(index, /app\.use\('\/user-profile', userProfileRoutes\);/);
    assertValidJs(project);
  });

  test("never overwrites an existing module", () => {
    const project = createProject("add-twice");
    cli(project, "add", "users");

    const modelPath = path.join(project, "src", "modules", "users", "users.model.js");
    fs.appendFileSync(modelPath, "// my change\n");
    const indexBefore = read(project, "src", "index.js");

    const result = cli(project, "add", "users");
    assert.equal(result.code, 1);
    assert.match(result.err, /already exists/);
    assert.match(fs.readFileSync(modelPath, "utf-8"), /\/\/ my change/);
    assert.equal(read(project, "src", "index.js"), indexBefore);
  });

  test("rejects names that would collide or escape the project", () => {
    const project = createProject("add-invalid");
    cli(project, "add", "user-profile");

    assert.match(cli(project, "add", "user_profile").err, /already registers/);
    assert.equal(exists(project, "src", "modules", "user_profile"), false);

    for (const name of ["../../escape", "a/b", "1abc", "my module", "a--b"]) {
      const result = cli(project, "add", name);
      assert.equal(result.code, 1, name);
      assert.match(result.err, /Invalid module name/);
    }
    assert.equal(exists(workDir, "escape"), false);
    assert.deepEqual(fs.readdirSync(path.join(project, "src", "modules")), ["user-profile"]);
  });

  test("fails without writing files when a route marker was removed", () => {
    const project = createProject("add-marker");
    const indexPath = path.join(project, "src", "index.js");
    fs.writeFileSync(indexPath, read(indexPath).replace("// ROUTE_MIDDLEWARE", ""));

    const result = cli(project, "add", "users");
    assert.equal(result.code, 1);
    assert.match(result.err, /ROUTE_MIDDLEWARE/);
    assert.equal(exists(project, "src", "modules", "users"), false);
  });

  test("fails outside a generated project", () => {
    const dir = path.join(workDir, "plain");
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, "package.json"), "{}");

    const result = cli(dir, "add", "users");
    assert.equal(result.code, 1);
    assert.match(result.err, /not an express-mod-cli project/);
    assert.deepEqual(fs.readdirSync(dir), ["package.json"]);
  });

  test("TypeScript projects get .ts modules", () => {
    const project = createProject("add-ts", "--ts");
    assert.equal(cli(project, "add", "users").code, 0);

    assert.match(read(project, "src", "index.ts"), /import usersRoutes from '\.\/modules\/users\/users\.routes';/);
    assert.match(read(project, "src", "modules", "users", "users.controller.ts"), /export async function getAll\(req: Request/);
    assert.equal(exists(project, "src", "modules", "users", "users.model.js"), false);
  });

  test("projects generated before v1.2.0 keep working", () => {
    const project = path.join(workDir, "legacy");
    fs.mkdirSync(path.join(project, "src"), { recursive: true });
    fs.writeFileSync(path.join(project, "package.json"), "{}");
    fs.writeFileSync(
      path.join(project, "src", "index.js"),
      "const app = require('express')();\n// ROUTE_IMPORTS\n\n// ROUTE_MIDDLEWARE\n"
    );

    assert.equal(cli(project, "add", "users").code, 0);
    const model = read(project, "src", "modules", "users", "users.model.js");
    assert.match(model, /mongoose\.model\('Users'/);
    assert.doesNotMatch(model, /getMongoConnection/);
    assertValidJs(project);

    assert.match(cli(project, "add-db", "analytics").err, /older version/);
    assert.match(cli(project, "add", "x", "--db", "analytics").err, /older version/);
  });
});

describe("add-db", () => {
  test("adds a second connection of another kind", () => {
    const project = createProject("multi");
    const result = cli(project, "add-db", "analytics", "--type", "postgres", "--skip-install");
    assert.equal(result.code, 0, result.err);

    assert.deepEqual(JSON.parse(read(project, ".expressmodrc.json")).databases, {
      default: { type: "mongodb" },
      analytics: { type: "postgres" },
    });

    assert.match(read(project, "src", "config", "databases.js"), /analytics: \{\n\s+type: 'postgres',\n\s+uri: process\.env\.DB_ANALYTICS_URI/);
    assert.ok(exists(project, "src", "config", "sql.js"));

    const db = read(project, "src", "config", "db.js");
    assert.match(db, /const sqlDriver = require\('\.\/sql'\);/);
    assert.match(db, /sqlDriver,\n\s+mongodbDriver,/);

    const pkg = JSON.parse(read(project, "package.json"));
    assert.ok(pkg.dependencies.sequelize && pkg.dependencies.pg && pkg.dependencies.mongoose);

    assert.match(read(project, ".env"), /^DB_ANALYTICS_URI=postgres:\/\//m);
    assert.match(read(project, ".env.example"), /^DB_ANALYTICS_URI=/m);
    assertValidJs(project);
  });

  test("modules can target any connection", () => {
    const project = createProject("multi-modules");
    cli(project, "add-db", "analytics", "--type", "postgres", "--skip-install");
    cli(project, "add-db", "logs"); // same kind as default: no new driver or packages

    assert.equal(cli(project, "add", "reports", "--db", "analytics").code, 0);
    assert.equal(cli(project, "add", "events", "--db", "logs").code, 0);

    assert.match(read(project, "src", "modules", "reports", "reports.model.js"), /getSqlConnection\('analytics'\)/);
    assert.match(read(project, "src", "modules", "reports", "reports.controller.js"), /findByPk/);
    assert.match(read(project, "src", "modules", "events", "events.model.js"), /getMongoConnection\('logs'\)/);
    assert.match(read(project, ".env"), /^DB_LOGS_URI=mongodb:\/\/.*\nDB_LOGS_NAME=logs$/m);
    assertValidJs(project);

    const result = cli(project, "add", "x", "--db", "missing");
    assert.equal(result.code, 1);
    assert.match(result.err, /"missing" does not exist\. Available: default, analytics, logs/);
    assert.equal(exists(project, "src", "modules", "x"), false);
  });

  test("a second SQL dialect reuses the driver but adds its package", () => {
    const project = createProject("two-sql", "--db", "postgres");
    assert.equal(cli(project, "add-db", "legacy", "--type", "mysql", "--skip-install").code, 0);

    const pkg = JSON.parse(read(project, "package.json"));
    assert.ok(pkg.dependencies.pg && pkg.dependencies.mysql2);
    assert.equal(read(project, "src", "config", "db.js").match(/sqlDriver,/g).length, 1);
  });

  test("works in TypeScript projects", () => {
    const project = createProject("multi-ts", "--ts", "--db", "postgres");
    assert.equal(cli(project, "add-db", "cache", "--type", "mongo", "--skip-install").code, 0);
    assert.equal(cli(project, "add", "sessions", "--db", "cache").code, 0);

    assert.ok(exists(project, "src", "config", "mongodb.ts"));
    assert.match(read(project, "src", "config", "db.ts"), /import \* as mongodbDriver from '\.\/mongodb';/);
    assert.match(read(project, "src", "modules", "sessions", "sessions.model.ts"), /getMongoConnection\('cache'\)/);
  });

  test("rejects duplicates, bad names and unknown types without changes", () => {
    const project = createProject("db-invalid");
    const before = read(project, "src", "config", "databases.js");

    assert.match(cli(project, "add-db", "default").err, /already exists/);
    assert.match(cli(project, "add-db", "my-db").err, /Invalid database connection name/);
    assert.match(cli(project, "add-db", "x", "--type", "oracle").err, /Unsupported database/);
    assert.match(cli(project, "add-db").err, /name for the database connection/);

    assert.equal(read(project, "src", "config", "databases.js"), before);
  });
});
