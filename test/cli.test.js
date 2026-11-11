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

    const index = read(project, "src", "app.js");
    assert.match(index, /const usersRoutes = require\('\.\/modules\/users\/users\.routes'\);/);
    assert.match(index, /app\.use\('\/users', usersRoutes\);/);
    assert.match(
      read(project, "src", "modules", "users", "users.model.js"),
      /getMongoConnection\('default'\)\.model\('User', userSchema\)/
    );
    assertValidJs(project);
  });

  test("hyphenated names become valid identifiers", () => {
    const project = createProject("add-hyphen");
    assert.equal(cli(project, "add", "user-profile").code, 0);

    const index = read(project, "src", "app.js");
    assert.match(index, /const userProfileRoutes = require\('\.\/modules\/user-profile\/user-profile\.routes'\);/);
    assert.match(index, /app\.use\('\/user-profile', userProfileRoutes\);/);
    assertValidJs(project);
  });

  test("never overwrites an existing module", () => {
    const project = createProject("add-twice");
    cli(project, "add", "users");

    const modelPath = path.join(project, "src", "modules", "users", "users.model.js");
    fs.appendFileSync(modelPath, "// my change\n");
    const indexBefore = read(project, "src", "app.js");

    const result = cli(project, "add", "users");
    assert.equal(result.code, 1);
    assert.match(result.err, /already exists/);
    assert.match(fs.readFileSync(modelPath, "utf-8"), /\/\/ my change/);
    assert.equal(read(project, "src", "app.js"), indexBefore);
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
    const indexPath = path.join(project, "src", "app.js");
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

    assert.match(read(project, "src", "app.ts"), /import usersRoutes from '\.\/modules\/users\/users\.routes';/);
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

    assert.equal(cli(project, "add", "users", "--skip-install").code, 0);
    const model = read(project, "src", "modules", "users", "users.model.js");
    assert.match(model, /mongoose\.model\('User'/);
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

describe("generated project (v1.3.0)", () => {
  test("has an app file, tests and the module helpers", () => {
    const project = createProject("gen-files");

    for (const file of [
      "src/app.js",
      "src/index.js",
      "src/middleware/validate.js",
      "src/utils/listQuery.js",
      "tests/app.test.js",
    ]) {
      assert.ok(exists(project, file), file);
    }
    assert.match(read(project, "src", "app.js"), /\/\/ ROUTE_IMPORTS[\s\S]*\/\/ ROUTE_MIDDLEWARE[\s\S]*module\.exports = app;/);
    assert.match(read(project, "src", "index.js"), /const app = require\('\.\/app'\);/);

    const pkg = JSON.parse(read(project, "package.json"));
    assert.equal(pkg.scripts.test, "node --test");
    assert.ok(pkg.dependencies.zod);
    assert.ok(pkg.devDependencies.supertest);
    // MongoDB needs no migrations
    assert.equal(pkg.scripts.migrate, undefined);
    assert.equal(exists(project, "src", "scripts"), false);
    assertValidJs(project);
  });

  test("SQL projects get a migration runner", () => {
    const project = createProject("gen-sql", "--db", "postgres");
    const pkg = JSON.parse(read(project, "package.json"));

    assert.deepEqual(Object.keys(pkg.scripts), ["start", "dev", "test", "migrate", "migrate:down", "migrate:status"]);
    assert.equal(pkg.scripts.migrate, "node src/scripts/migrate.js up");
    assert.ok(pkg.dependencies.umzug);
    assert.ok(exists(project, "src", "scripts", "migrate.js"));
    assert.match(read(project, "src", "config", "sql.js"), /getMigrator/);
    assertValidJs(project);
  });

  test("TypeScript projects run their tests with tsx", () => {
    const project = createProject("gen-ts", "--ts", "--db", "mysql");
    const pkg = JSON.parse(read(project, "package.json"));

    assert.equal(pkg.scripts.test, 'tsx --test "tests/**/*.test.ts"');
    assert.equal(pkg.scripts.migrate, "tsx src/scripts/migrate.ts up");
    assert.ok(pkg.devDependencies["@types/supertest"]);
    for (const file of ["src/app.ts", "tests/app.test.ts", "src/scripts/migrate.ts", "src/utils/listQuery.ts"]) {
      assert.ok(exists(project, file), file);
    }
  });
});

describe("add with fields", () => {
  test("uses the default fields when none are given", () => {
    const project = createProject("fields-default");
    cli(project, "add", "users");

    const validation = read(project, "src", "modules", "users", "users.validation.js");
    assert.match(validation, /name: z\.string\(\)\.trim\(\)\.min\(1\),/);
    assert.match(validation, /description: z\.string\(\)\.trim\(\)\.min\(1\)\.nullish\(\),/);
    assert.match(validation, /status: z\.enum\(\['active', 'inactive'\]\)\.optional\(\)/);
  });

  test("generates Mongoose schema and Zod validation from the fields", () => {
    const project = createProject("fields-mongo");
    const result = cli(project, "add", "products", "name:string:unique", "price:number", "stock:int:default=0",
      "status:enum:draft,published:default=draft", "releasedAt:date:optional", "url:string:default=http://x.io/a");
    assert.equal(result.code, 0, result.err);

    const model = read(project, "src", "modules", "products", "products.model.js");
    assert.match(model, /name: \{\n\s+type: String,\n\s+required: true,\n\s+trim: true,\n\s+unique: true\n\s+\}/);
    assert.match(model, /stock: \{\n\s+type: Number,\n\s+validate: \{ validator: Number\.isInteger[^\n]+\n\s+default: 0\n/);
    assert.match(model, /status: \{\n\s+type: String,\n\s+enum: \['draft', 'published'\],\n\s+default: 'draft'\n/);
    assert.match(model, /url: \{[\s\S]*?default: 'http:\/\/x\.io\/a'/);

    const validation = read(project, "src", "modules", "products", "products.validation.js");
    assert.match(validation, /price: z\.number\(\),/);
    assert.match(validation, /stock: z\.number\(\)\.int\(\)\.optional\(\),/);
    assert.match(validation, /releasedAt: z\.string\(\)\.refine\([^\n]+\.nullish\(\),/);
    assertValidJs(project);
  });

  test("generates a Sequelize model and its migration from the fields", () => {
    const project = createProject("fields-sql", "--db", "postgres");
    assert.equal(cli(project, "add", "order-items", "title:string", "qty:integer", "paid:boolean:default=false").code, 0);

    const model = read(project, "src", "modules", "order-items", "order-items.model.js");
    assert.match(model, /sequelize\.define\('OrderItem', \{/);
    assert.match(model, /tableName: 'order_items'/);
    assert.match(model, /qty: \{\n\s+type: DataTypes\.INTEGER,\n\s+allowNull: false\n\s+\}/);

    const [migration, ...others] = fs.readdirSync(path.join(project, "src", "migrations", "default"));
    assert.deepEqual(others, []);
    assert.match(migration, /^\d{14}-create-order-items\.js$/);
    const content = read(project, "src", "migrations", "default", migration);
    assert.match(content, /createTable\('order_items', \{\n\s+id: \{/);
    assert.match(content, /paid: \{\n\s+type: DataTypes\.BOOLEAN,\n\s+allowNull: false,\n\s+defaultValue: false\n/);
    assert.match(content, /dropTable\('order_items'\)/);
    assertValidJs(project);
  });

  test("rejects invalid fields without writing anything", () => {
    const project = createProject("fields-invalid");
    const appBefore = read(project, "src", "app.js");

    const cases = [
      [["price:money"], /unknown type "money"/],
      [["price"], /the type is missing/],
      [["id:string"], /added automatically/],
      [["name:string", "name:text"], /defined more than once/],
      [["status:enum"], /list the allowed values/],
      [["status:enum:a,b:default=c"], /not one of: a, b/],
      [["stock:integer:default=1.5"], /not an integer/],
      [["active:boolean:default=yes"], /true or false/],
      [["bio:text:unique"], /cannot be unique/],
      [["born:date:default=2020-01-01"], /not supported for date/],
      [["name:string:required:secret"], /unknown option "secret"/],
      [["1name:string"], /not a valid field name/],
    ];

    for (const [fields, error] of cases) {
      const result = cli(project, "add", "items", ...fields);
      assert.equal(result.code, 1, fields.join(" "));
      assert.match(result.err, error, fields.join(" "));
    }

    assert.equal(exists(project, "src", "modules", "items"), false);
    assert.equal(read(project, "src", "app.js"), appBefore);
  });

  test("controllers support pagination, sorting and search", () => {
    const project = createProject("fields-list", "--db", "mysql");
    cli(project, "add", "articles", "title:string", "views:integer:default=0");

    const controller = read(project, "src", "modules", "articles", "articles.controller.js");
    assert.match(controller, /const SORTABLE_FIELDS = \['id', 'title', 'views', 'createdAt', 'updatedAt'\];/);
    assert.match(controller, /const SEARCHABLE_FIELDS = \['title'\];/);
    assert.match(controller, /findAndCountAll\(\{ where, order: sort, offset, limit \}\)/);
    assert.match(controller, /tieBreaker: 'id'/);
    assert.match(controller, /pagination: paginate\(total, page, limit\)/);

    // No text fields: no search
    cli(project, "add", "counters", "value:integer");
    const counters = read(project, "src", "modules", "counters", "counters.controller.js");
    assert.doesNotMatch(counters, /SEARCHABLE_FIELDS|Op\b/);
    assertValidJs(project);
  });

  test("every module gets validation-only tests", () => {
    const project = createProject("fields-tests");
    cli(project, "add", "products", "price:number");

    const content = read(project, "tests", "products.test.js");
    assert.match(content, /require\('\.\.\/src\/app'\)/);
    assert.match(content, /post\('\/products'\)\.send\(\{ price: 'not-a-number' \}\)/);
    assert.match(content, /error\.field === 'price'/);
  });
});

describe("naming", () => {
  test("models are singular, tables and messages read naturally", () => {
    const project = createProject("naming", "--db", "postgres");
    cli(project, "add", "people");
    cli(project, "add", "categories");

    const model = read(project, "src", "modules", "people", "people.model.js");
    assert.match(model, /const PersonModel = sequelize\.define\('Person'/);
    assert.match(model, /tableName: 'people'/);

    const controller = read(project, "src", "modules", "categories", "categories.controller.js");
    assert.match(controller, /'Category created successfully'/);
    assert.match(controller, /'Categories retrieved successfully'/);
    assert.match(controller, /'Category not found'/);
  });

  test("rejects a module whose model name is already used", () => {
    const project = createProject("naming-clash");
    cli(project, "add", "users");

    const result = cli(project, "add", "user");
    assert.equal(result.code, 1);
    assert.match(result.err, /"users" already defines the model "User"/);
    assert.equal(exists(project, "src", "modules", "user"), false);
  });
});

describe("add-migration", () => {
  test("creates empty migrations in timestamp order", () => {
    const project = createProject("mig", "--db", "postgres");
    cli(project, "add", "users");
    assert.equal(cli(project, "add-migration", "add-phone-to-users").code, 0);
    assert.equal(cli(project, "add-migration", "add_index").code, 0);

    const files = fs.readdirSync(path.join(project, "src", "migrations", "default"));
    assert.equal(files.length, 3);
    assert.match(files[1], /^\d{14}-add-phone-to-users\.js$/);
    assert.match(files[2], /^\d{14}-add-index\.js$/);
    // Strictly increasing, even when created within the same second
    assert.deepEqual([...files].sort(), files);
    assert.equal(new Set(files.map((file) => file.slice(0, 14))).size, 3);
    assertValidJs(project);
  });

  test("works per connection and only for SQL", () => {
    const project = createProject("mig-multi");
    cli(project, "add-db", "analytics", "--type", "mysql", "--skip-install");

    assert.match(cli(project, "add-migration", "x").err, /not a SQL database/);
    assert.match(cli(project, "add-migration", "x", "--db", "nope").err, /does not exist/);
    assert.match(cli(project, "add-migration", "../x", "--db", "analytics").err, /Invalid migration name/);
    assert.match(cli(project, "add-migration").err, /name for the migration/);

    assert.equal(cli(project, "add-migration", "seed", "--db", "analytics").code, 0);
    assert.equal(fs.readdirSync(path.join(project, "src", "migrations", "analytics")).length, 1);
  });

  test("add-db sets up migrations when the first SQL database is added", () => {
    const project = createProject("mig-add-db");
    cli(project, "add-db", "reports", "--type", "postgres", "--skip-install");

    const pkg = JSON.parse(read(project, "package.json"));
    assert.deepEqual(Object.keys(pkg.scripts), ["start", "dev", "test", "migrate", "migrate:down", "migrate:status"]);
    assert.ok(pkg.dependencies.umzug);
    assert.ok(exists(project, "src", "scripts", "migrate.js"));

    cli(project, "add", "sales", "amount:number", "--db", "reports");
    assert.equal(fs.readdirSync(path.join(project, "src", "migrations", "reports")).length, 1);
    // MongoDB modules need none
    cli(project, "add", "notes");
    assert.equal(exists(project, "src", "migrations", "default"), false);
  });
});

describe("projects generated by v1.2.0", () => {
  /** Turn a fresh project into what v1.2.0 generated */
  function makeV120Project(name) {
    const project = createProject(name, "--db", "postgres");
    const app = read(project, "src", "app.js");

    // Routes lived in src/index.js, and there was no app file
    fs.writeFileSync(path.join(project, "src", "index.js"), app.replace("module.exports = app;", "app.listen(5000);"));
    fs.rmSync(path.join(project, "src", "app.js"));
    for (const file of ["src/middleware/validate.js", "src/utils/listQuery.js", "src/scripts", "tests"]) {
      fs.rmSync(path.join(project, file), { recursive: true });
    }
    // sync() instead of migrations
    fs.writeFileSync(path.join(project, "src", "config", "sql.js"), "// uses sequelize.sync()\n");

    const pkg = JSON.parse(read(project, "package.json"));
    delete pkg.dependencies.zod;
    delete pkg.devDependencies.supertest;
    fs.writeFileSync(path.join(project, "package.json"), JSON.stringify(pkg, null, 2));
    return project;
  }

  test("new modules add what they need", () => {
    const project = makeV120Project("v120");
    const result = cli(project, "add", "products", "name:string", "--skip-install");
    assert.equal(result.code, 0, result.err);
    assert.match(result.out, /Added to package\.json: zod\nRun "npm install"/);

    assert.match(read(project, "src", "index.js"), /app\.use\('\/products', productsRoutes\);/);
    assert.ok(exists(project, "src", "middleware", "validate.js"));
    assert.ok(exists(project, "src", "utils", "listQuery.js"));
    assert.ok(JSON.parse(read(project, "package.json")).dependencies.zod);
    // No test runner and no migrations in those projects
    assert.equal(exists(project, "tests"), false);
    assert.equal(exists(project, "src", "migrations"), false);
  });

  test("add-migration explains that migrations need a newer project", () => {
    const project = makeV120Project("v120-mig");
    const result = cli(project, "add-migration", "x");
    assert.equal(result.code, 1);
    assert.match(result.err, /before migrations were added/);
  });
});

describe("interactive create", () => {
  const { PassThrough } = require("node:stream");
  const { askCreateOptions } = require("../lib/commands/createProject");

  /** Answer the prompts with the given lines and collect what was printed */
  async function ask(options, lines) {
    const input = new PassThrough();
    const output = new PassThrough();
    let printed = "";
    output.on("data", (chunk) => (printed += chunk));
    input.end(lines.map((line) => `${line}\n`).join(""));

    const result = await askCreateOptions(options, { input, output });
    return { result, printed };
  }

  test("asks for everything that is missing", async () => {
    const { result, printed } = await ask({}, ["../bad", "my-api", "7", "2", "postgres"]);

    assert.deepEqual(result, { name: "my-api", language: "ts", dbType: "postgres" });
    assert.match(printed, /Invalid project name "\.\.\/bad"/);
    assert.match(printed, /Please enter a number from 1 to 2/);
  });

  test("Enter picks the default, given values are not asked", async () => {
    const { result, printed } = await ask({ name: "x", dbType: "mysql" }, [""]);

    assert.deepEqual(result, { name: "x", language: "js", dbType: "mysql" });
    assert.doesNotMatch(printed, /Project name|Database/);
  });

  test("end of input cancels", async () => {
    await assert.rejects(ask({}, []), /Cancelled/);
  });

  test("non-interactive runs never prompt", () => {
    const result = cli(workDir, "create");
    assert.equal(result.code, 1);
    assert.match(result.err, /provide a project name/);
  });
});

describe("generated helpers", () => {
  const { parseListQuery, paginate, escapeLike, escapeRegex } = require("../lib/templates/static/listQuery.js");
  const sortable = ["name", "createdAt"];

  test("parseListQuery reads paging, sorting and search", () => {
    assert.deepEqual(parseListQuery({}, { sortable }), {
      page: 1, limit: 20, offset: 0, sort: [["createdAt", "desc"]], search: "",
    });
    assert.deepEqual(parseListQuery({ page: "3", limit: "500", sort: "name,-createdAt", search: " a " }, { sortable }), {
      page: 3, limit: 100, offset: 200, sort: [["name", "asc"], ["createdAt", "desc"]], search: "a",
    });
  });

  test("parseListQuery appends the tie-breaker once", () => {
    assert.deepEqual(parseListQuery({}, { sortable, tieBreaker: "id" }).sort, [["createdAt", "desc"], ["id", "asc"]]);
    assert.deepEqual(
      parseListQuery({ sort: "-id" }, { sortable: ["id"], tieBreaker: "id" }).sort,
      [["id", "desc"]]
    );
  });

  test("parseListQuery rejects bad input with a 400", () => {
    for (const query of [{ page: "0" }, { limit: "abc" }, { page: "1.5" }, { sort: "password" }]) {
      assert.throws(() => parseListQuery(query, { sortable }), (error) => error.statusCode === 400, JSON.stringify(query));
    }
  });

  test("paginate and the escape helpers", () => {
    assert.deepEqual(paginate(41, 2, 20), { page: 2, limit: 20, total: 41, totalPages: 3 });
    assert.equal(escapeLike("50%_off\\"), "50\\%\\_off\\\\");
    assert.ok(new RegExp(escapeRegex("a.b(c)")).test("a.b(c)"));
    assert.ok(!new RegExp(escapeRegex("a.b")).test("axb"));
  });
});

describe("command line", () => {
  test("only add accepts extra arguments", () => {
    assert.match(cli(workDir, "create", "a", "b").err, /Unexpected argument: b/);
    assert.equal(exists(workDir, "a"), false);
  });
});

describe("add-auth", () => {
  const authFiles = (ext) => [
    `src/config/auth.${ext}`,
    `src/utils/security.${ext}`,
    `src/utils/mailer.${ext}`,
    `src/middleware/auth.${ext}`,
    `src/modules/auth/user.model.${ext}`,
    `src/modules/auth/refresh-token.model.${ext}`,
    `src/modules/auth/auth-token.model.${ext}`,
    `src/modules/auth/auth.emails.${ext}`,
    `src/modules/auth/auth.repository.${ext}`,
    `src/modules/auth/auth.validation.${ext}`,
    `src/modules/auth/auth.controller.${ext}`,
    `src/modules/auth/auth.routes.${ext}`,
    `src/scripts/set-role.${ext}`,
    `tests/auth.test.${ext}`,
  ];

  test("sets up authentication in a MongoDB project", () => {
    const project = createProject("auth-mongo");
    const result = cli(project, "add-auth", "--skip-install");
    assert.equal(result.code, 0, result.err);

    for (const file of authFiles("js")) assert.ok(exists(project, file), file);
    assert.match(read(project, "src", "modules", "auth", "user.model.js"), /getMongoConnection\('default'\)\.model\('User'/);
    assert.equal(exists(project, "src", "migrations"), false);

    const app = read(project, "src", "app.js");
    assert.match(app, /const helmet = require\('helmet'\);\nconst cookieParser = require\('cookie-parser'\);/);
    assert.match(app, /app\.use\(express\.urlencoded\(\{ extended: true \}\)\);\napp\.use\(cookieParser\(\)\);/);
    assert.match(app, /app\.use\('\/auth', authRoutes\);/);

    const pkg = JSON.parse(read(project, "package.json"));
    for (const name of ["bcryptjs", "cookie-parser", "express-rate-limit", "jsonwebtoken", "nodemailer"]) assert.ok(pkg.dependencies[name], name);
    assert.match(read(project, ".env"), /^APP_URL=http:\/\/localhost:3000$/m);
    assert.match(read(project, ".env"), /^SMTP_HOST=$/m);
    assert.equal(pkg.scripts["auth:set-role"], "node src/scripts/set-role.js");
    assert.deepEqual(JSON.parse(read(project, ".expressmodrc.json")).auth, { connection: "default" });

    const env = read(project, ".env");
    assert.equal(env.match(/^JWT_SECRET=/gm).length, 1);
    assert.doesNotMatch(env, /JWT Configuration \(optional\)/);
    const secret = env.match(/^JWT_SECRET=(.+)$/m)[1];
    assert.ok(secret.length >= 32);
    assert.match(read(project, ".env.example"), /^JWT_SECRET=change-me/m);
    assertValidJs(project);
  });

  test("replaces an existing JWT_SECRET instead of defining it twice", () => {
    const project = createProject("auth-env");
    // Projects from v1.3.0 and older have a placeholder secret
    fs.appendFileSync(path.join(project, ".env"), "\n# JWT Configuration (optional)\nJWT_SECRET=your_jwt_secret_here\n\nAPI_VERSION_2=x\n");
    cli(project, "add-auth", "--skip-install");

    const env = read(project, ".env");
    assert.equal(env.match(/^JWT_SECRET=/gm).length, 1);
    assert.doesNotMatch(env, /your_jwt_secret_here|JWT Configuration \(optional\)/);
    assert.match(env, /^API_VERSION_2=x$/m);
  });

  test("SQL projects get a migration, and every project its own secret", () => {
    const one = createProject("auth-sql", "--db", "postgres");
    const two = createProject("auth-sql-2", "--db", "mysql");
    cli(one, "add-auth", "--skip-install");
    cli(two, "add-auth", "--skip-install");

    const [migration] = fs.readdirSync(path.join(one, "src", "migrations", "default"));
    assert.match(migration, /^\d{14}-create-auth-tables\.js$/);
    const content = read(one, "src", "migrations", "default", migration);
    assert.match(content, /createTable\('users'/);
    assert.match(content, /emailVerifiedAt: \{ type: DataTypes\.DATE \}/);
    assert.match(content, /createTable\('auth_tokens'/);
    assert.match(content, /dropTable\('auth_tokens'\);\n\s+await queryInterface\.dropTable\('refresh_tokens'\);\n\s+await queryInterface\.dropTable\('users'\)/);
    assert.match(content, /references: \{ model: 'users', key: 'id' \},\n\s+onDelete: 'CASCADE'/);
    assert.match(read(one, "src", "modules", "auth", "auth.repository.js"), /RefreshTokenModel\.update/);

    const secret = (project) => read(project, ".env").match(/^JWT_SECRET=(.+)$/m)[1];
    assert.notEqual(secret(one), secret(two));
    assertValidJs(one);
  });

  test("TypeScript projects get typed files and type definitions", () => {
    const project = createProject("auth-ts", "--ts", "--db", "postgres");
    assert.equal(cli(project, "add-auth", "--skip-install").code, 0);

    for (const file of authFiles("ts")) assert.ok(exists(project, file), file);
    assert.match(read(project, "src", "app.ts"), /import helmet from 'helmet';\nimport cookieParser from 'cookie-parser';/);
    assert.match(read(project, "src", "middleware", "auth.ts"), /interface Request \{[\s\S]*user\?: AuthUser;/);

    const pkg = JSON.parse(read(project, "package.json"));
    assert.ok(pkg.devDependencies["@types/jsonwebtoken"] && pkg.devDependencies["@types/cookie-parser"]);
    assert.equal(pkg.dependencies["@types/jsonwebtoken"], undefined);
    assert.equal(pkg.scripts["auth:set-role"], "tsx src/scripts/set-role.ts");
  });

  test("users can live on another connection", () => {
    const project = createProject("auth-multi", "--db", "postgres");
    cli(project, "add-db", "accounts", "--type", "mongodb", "--skip-install");
    assert.equal(cli(project, "add-auth", "--db", "accounts", "--skip-install").code, 0);

    assert.match(read(project, "src", "modules", "auth", "user.model.js"), /getMongoConnection\('accounts'\)/);
    assert.equal(exists(project, "src", "migrations", "default"), false);
    assert.deepEqual(JSON.parse(read(project, ".expressmodrc.json")).auth, { connection: "accounts" });
  });

  test("refuses to run twice or over existing code", () => {
    const project = createProject("auth-refuse");
    assert.match(cli(project, "add-auth", "--db", "nope").err, /"nope" does not exist/);
    assert.match(cli(project, "add-auth", "extra").err, /Unexpected argument: extra/);

    cli(project, "add-auth", "--skip-install");
    assert.match(cli(project, "add-auth").err, /already set up/);

    const withUsers = createProject("auth-users-module");
    cli(withUsers, "add", "users");
    const result = cli(withUsers, "add-auth");
    assert.equal(result.code, 1);
    assert.match(result.err, /"users" already defines the model "User"/);
    assert.equal(exists(withUsers, "src", "modules", "auth"), false);
  });

  test("stops without writing when the app file was changed", () => {
    const project = createProject("auth-app-changed");
    const appPath = path.join(project, "src", "app.js");
    fs.writeFileSync(appPath, read(appPath).replace("const helmet = require('helmet');\n", ""));
    const before = read(appPath);

    const result = cli(project, "add-auth");
    assert.equal(result.code, 1);
    assert.match(result.err, /Add these lines yourself[\s\S]*require\('cookie-parser'\)[\s\S]*app\.use\(cookieParser\(\)\)/);
    assert.equal(read(appPath), before);
    assert.equal(exists(project, "src", "modules", "auth"), false);
    assert.equal(JSON.parse(read(project, ".expressmodrc.json")).auth, undefined);
  });
});

describe("protected modules", () => {
  test("--auth and --role need add-auth first", () => {
    const project = createProject("protect-no-auth");
    assert.match(cli(project, "add", "orders", "--auth").err, /Run "express-mod-cli add-auth" first/);
    assert.match(cli(project, "add", "orders", "--role", "admin").err, /Run "express-mod-cli add-auth" first/);
    assert.equal(exists(project, "src", "modules", "orders"), false);
  });

  test("--auth guards every route, and the tests send a token", () => {
    const project = createProject("protect-auth");
    cli(project, "add-auth", "--skip-install");
    assert.equal(cli(project, "add", "orders", "total:number", "--auth").code, 0);

    const routes = read(project, "src", "modules", "orders", "orders.routes.js");
    assert.match(routes, /const \{ requireAuth \} = require\('\.\.\/\.\.\/middleware\/auth'\);/);
    assert.match(routes, /router\.use\(requireAuth\);\n\n\/\/ CRUD routes/);

    const tests = read(project, "tests", "orders.test.js");
    assert.match(tests, /needs a logged-in user[\s\S]*401/);
    assert.match(tests, /\.set\('Authorization', tokenFor\('user'\)\)\.send\(\{ total: 'not-a-number' \}\)/);
    assert.doesNotMatch(tests, /403/);
    assertValidJs(project);
  });

  test("--role requires that role", () => {
    const project = createProject("protect-role", "--ts");
    cli(project, "add-auth", "--skip-install");
    assert.equal(cli(project, "add", "reports", "title:string", "--role", "admin").code, 0);

    const routes = read(project, "src", "modules", "reports", "reports.routes.ts");
    assert.match(routes, /import \{ requireRole \} from '\.\.\/\.\.\/middleware\/auth';/);
    assert.match(routes, /router\.use\(requireRole\('admin'\)\);/);
    assert.match(read(project, "tests", "reports.test.ts"), /needs the "admin" role[\s\S]*tokenFor\('user'\)[\s\S]*403/);

    assert.match(cli(project, "add", "x", "--role", "bad role").err, /Invalid role/);
  });

  test("modules cannot reuse the auth model names", () => {
    const project = createProject("protect-names");
    cli(project, "add-auth", "--skip-install");

    assert.match(cli(project, "add", "users").err, /"auth" already defines the model "User"/);
    assert.match(cli(project, "add", "refresh-tokens").err, /"auth" already defines the model "RefreshToken"/);
    assert.match(cli(project, "add", "auth-tokens").err, /"auth" already defines the model "AuthToken"/);
    assert.equal(cli(project, "add", "profiles").code, 0);
  });
});

describe("file, image and ref fields", () => {
  test("ref fields point to an existing module on the same connection", () => {
    const project = createProject("ref-fields-sql", "--ts", "--db", "postgres");
    assert.match(cli(project, "add", "orders", "customer:ref:customers").err, /module "customers", which doesn't exist/);
    assert.match(cli(project, "add", "orders", "customer:ref").err, /name the module it points to/);
    assert.match(cli(project, "add", "orders", "photo:image:unique").err, /image fields cannot be unique/);

    assert.equal(cli(project, "add", "customers", "name:string", "--skip-install").code, 0);
    assert.equal(
      cli(project, "add", "orders", "customer:ref:customers", "parent:ref:orders:optional", "--skip-install").code,
      0
    );

    const model = read(project, "src", "modules", "orders", "orders.model.ts");
    assert.match(model, /declare customer: number;/);
    assert.match(model, /references: \{ model: 'customers', key: 'id' \}/);
    assert.match(read(project, "src", "modules", "orders", "orders.validation.ts"), /customer: z\.number\(\)\.int\(\)\.positive\(\),/);

    const migrations = path.join(project, "src", "migrations", "default");
    const migration = read(migrations, fs.readdirSync(migrations).find((file) => file.endsWith("-create-orders.ts")));
    assert.match(migration, /onDelete: 'RESTRICT'/);
    assert.match(migration, /references: \{ model: 'orders', key: 'id' \},\n\s+onDelete: 'SET NULL'/);
  });

  test("records can't point to another database", () => {
    const project = createProject("ref-fields-db");
    cli(project, "add-db", "analytics", "--skip-install");
    cli(project, "add", "customers", "name:string", "--skip-install");
    const result = cli(project, "add", "visits", "customer:ref:customers", "--db", "analytics", "--skip-install");
    assert.equal(result.code, 1);
    assert.match(result.err, /same database/);
  });
});

describe("add-admin", () => {
  test("needs add-auth first", () => {
    const project = createProject("admin-no-auth");
    const result = cli(project, "add-admin");
    assert.equal(result.code, 1);
    assert.match(result.err, /Run "express-mod-cli add-auth" first/);
    assert.equal(exists(project, "src", "admin"), false);
  });

  test("refuses extra arguments, bad options or running twice", () => {
    const project = createProject("admin-twice");
    cli(project, "add-auth", "--skip-install");
    const appBefore = read(project, "src", "app.js");

    assert.match(cli(project, "add-admin", "extra").err, /Unexpected argument: extra/);
    assert.match(cli(project, "add-admin", "--path", "no-slash").err, /Invalid admin path/);
    assert.match(cli(project, "add-admin", "--path", "/auth").err, /already used by a module/);
    assert.match(cli(project, "add-admin", "--theme", "pink").err, /Unknown theme "pink"/);
    assert.match(cli(project, "add-admin", "--role", "editor").err, /only allows the roles user, admin/);
    assert.match(cli(project, "add-admin", "--role", "staff").err, /is for staff members/);
    // Nothing was written by the failed attempts
    assert.equal(exists(project, "src", "admin"), false);
    assert.equal(read(project, "src", "app.js"), appBefore);

    const first = cli(project, "add-admin", "--skip-install");
    assert.equal(first.code, 0, first.err);

    const second = cli(project, "add-admin", "--skip-install");
    assert.equal(second.code, 1);
    assert.match(second.err, /already set up/);
  });

  test("sets up the panel in a JavaScript + MongoDB project", () => {
    const project = createProject("admin-mongo");
    cli(project, "add-auth", "--skip-install");
    const result = cli(project, "add-admin", "--skip-install");
    assert.equal(result.code, 0, result.err);

    for (const file of [
      "admin.config.js", "router.js", "index.js", "resources.js", "authenticate.js", "session.js",
      "zodHooks.js", "users.resource.js", "defaultAdmin.js", "translations.js",
    ]) {
      assert.ok(exists(project, "src", "admin", file), file);
    }
    for (const component of ["Dashboard", "Login", "LoggedIn", "SidebarBranding", "TopBar", "Export", "Import"]) {
      assert.ok(exists(project, "src", "admin", "components", `${component}.jsx`), component);
    }
    for (const file of ["permissions.js", "adminLog.js", "auditLog.js", "importExport.js", "uploads.js", "passwordReset.js", "theme.js", "themes.js"]) {
      assert.ok(exists(project, "src", "admin", file), file);
    }
    assert.match(read(project, "src", "admin", "adminLog.js"), /mongoose\.Schema/);
    for (const theme of ["classic.css", "classic-dark.css", "modern.css", "modern-dark.css", "theme.bundle.js"]) {
      assert.ok(exists(project, "src", "admin", "themes", theme), theme);
    }
    assert.match(read(project, ".env"), /ADMIN_THEME=classic$/m);

    // Staff members may view, add and edit
    assert.match(read(project, "src", "modules", "auth", "user.model.js"), /enum: \['user', 'admin', 'staff'\]/);
    assert.match(result.out, /"staff" role/);

    // Uploaded files are served with their own security headers
    const appFile = read(project, "src", "app.js");
    assert.match(appFile, /const \{ serveUploads \} = require\('\.\/admin\/uploads'\);/);
    assert.ok(appFile.indexOf("app.use('/uploads', serveUploads());") > appFile.indexOf("app.use(helmet());"));
    assert.match(read(project, ".gitignore"), /^uploads\/$/m);
    assert.ok(exists(project, "src", "scripts", "create-admin.js"));

    // The router is mounted right after the app is created, before helmet and the body parsers
    const app = read(project, "src", "app.js");
    assert.match(app, /const adminRouter = require\('\.\/admin\/router'\);/);
    assert.ok(app.indexOf("app.use('/admin', adminRouter);") < app.indexOf("app.use(helmet());"));
    assert.ok(app.indexOf("app.use('/admin', adminRouter);") > app.indexOf("const app = express();"));

    const index = read(project, "src", "index.js");
    assert.match(index, /const \{ mountAdmin \} = require\('\.\/admin'\);/);
    assert.match(index, /\n    await connectDB\(\);\n    await mountAdmin\(\);\n/);

    const config = read(project, "src", "admin", "admin.config.js");
    assert.match(config, /path: '\/admin'/);
    assert.match(config, /role: 'admin'/);
    assert.match(config, /connection: 'default'/);
    assert.doesNotMatch(config, /__[A-Z_]+__/);

    // A first admin user is created on startup from .env
    const env = read(project, ".env");
    assert.match(env, /ADMIN_COOKIE_SECRET=[\w-]{32,}/);
    assert.match(env, /ADMIN_EMAIL=admin@example\.com/);
    assert.match(env, /ADMIN_PASSWORD=[\w-]{16}/);
    assert.match(result.out, /Email: +admin@example\.com/);
    assert.match(read(project, ".env.example"), /ADMIN_PASSWORD=change-me/);

    assert.deepEqual(JSON.parse(read(project, ".expressmodrc.json")).admin, { path: "/admin", role: "admin" });

    const pkg = JSON.parse(read(project, "package.json"));
    for (const dep of ["adminjs", "@adminjs/express", "@adminjs/themes", "@adminjs/mongoose", "connect-mongo", "express-session"]) {
      assert.ok(pkg.dependencies[dep], dep);
    }
    assert.equal(pkg.dependencies["@adminjs/sequelize"], undefined);
    assert.equal(pkg.scripts["admin:create"], "node src/scripts/create-admin.js");
    assert.deepEqual(pkg.nodemonConfig.ignore, [".adminjs/*"]);

    assert.ok(exists(project, "tests", "admin.test.js"));
    assert.match(read(project, ".gitignore"), /\.adminjs\//);

    assertValidJs(project);
  });

  test("TypeScript + PostgreSQL: custom path, sessions migration and adapters", () => {
    const project = createProject("admin-sql-ts", "--ts", "--db", "postgres");
    cli(project, "add-auth", "--skip-install");
    const result = cli(project, "add-admin", "--skip-install", "--path", "/backoffice", "--theme", "dark");
    assert.equal(result.code, 0, result.err);

    const app = read(project, "src", "app.ts");
    assert.match(app, /import adminRouter from '\.\/admin\/router';/);
    assert.match(app, /app\.use\('\/backoffice', adminRouter\);/);
    assert.match(read(project, "src", "index.ts"), /import \{ mountAdmin \} from '\.\/admin';/);

    // The panel's own path, used for its links and login page
    const config = read(project, "src", "admin", "admin.config.ts");
    assert.match(config, /path: '\/backoffice'/);
    assert.match(config, /process\.env\.ADMIN_THEME \|\| 'dark'/);

    const migrations = fs.readdirSync(path.join(project, "src", "migrations", "default"));
    const sessions = migrations.find((file) => file.endsWith("-create-admin-tables.ts"));
    assert.ok(sessions);
    const migration = read(project, "src", "migrations", "default", sessions);
    assert.match(migration, /export async function up\(\{ context: queryInterface \}: MigrationParams\)/);
    assert.match(migration, /createTable\('admin_sessions'/);
    assert.match(migration, /createTable\('admin_logs'/);
    assert.match(read(project, "src", "admin", "adminLog.ts"), /tableName: 'admin_logs'/);
    assert.match(read(project, "src", "modules", "auth", "user.model.ts"), /isIn: \[\['user', 'admin', 'staff'\]\]/);

    const pkg = JSON.parse(read(project, "package.json"));
    assert.ok(pkg.dependencies["@adminjs/sequelize"]);
    assert.ok(pkg.dependencies["connect-session-sequelize"]);
    assert.equal(pkg.dependencies["@adminjs/mongoose"], undefined);
    assert.ok(pkg.devDependencies["@types/express-session"]);
    assert.equal(pkg.scripts["admin:create"], "tsx src/scripts/create-admin.ts");
    assert.equal(pkg.nodemonConfig, undefined);

    assert.deepEqual(JSON.parse(read(project, ".expressmodrc.json")).admin, { path: "/backoffice", role: "admin" });
  });

  test("existing modules read their fields from the model, new modules get them from the command", () => {
    const project = createProject("admin-modules");
    cli(project, "add-auth", "--skip-install");
    cli(project, "add-db", "analytics", "--type", "postgres", "--skip-install");
    cli(project, "add", "products", "name:string", "price:number", "--skip-install");
    cli(project, "add", "visits", "page:string", "--db", "analytics", "--skip-install");

    assert.equal(cli(project, "add-admin", "--skip-install").code, 0);

    const products = read(project, "src", "modules", "products", "products.admin.js");
    assert.match(products, /navigation: \{ name: 'Modules'/);
    assert.match(products, /zodHooks\(createProductSchema\)/);
    assert.doesNotMatch(products, /listProperties/);
    assert.match(read(project, "src", "modules", "visits", "visits.admin.js"), /navigation: \{ name: 'Analytics'/);

    const resources = read(project, "src", "admin", "resources.js");
    assert.match(resources, /const productsAdmin = require\('\.\.\/modules\/products\/products\.admin'\);/);
    assert.match(resources, /productsAdmin\(helpers\),/);
    assert.ok(resources.indexOf("productsAdmin(helpers)") < resources.indexOf("visitsAdmin(helpers)"));

    const pkg = JSON.parse(read(project, "package.json"));
    assert.ok(pkg.dependencies["@adminjs/mongoose"]);
    assert.ok(pkg.dependencies["@adminjs/sequelize"]);

    // Added after the admin panel: the fields from the command line
    assert.equal(
      cli(project, "add", "orders", "total:integer", "note:text:optional", "shippedAt:date:optional", "--skip-install").code,
      0
    );
    const orders = read(project, "src", "modules", "orders", "orders.admin.js");
    assert.match(orders, /listProperties: \['total', 'note', 'shippedAt', 'createdAt'\]/);
    assert.match(orders, /showProperties: \['_id', 'total'/);
    assert.match(orders, /note: \{ type: 'textarea' \}/);
    assert.match(orders, /shippedAt: \{ type: 'date' \}/);
    assert.match(read(project, "src", "admin", "resources.js"), /ordersAdmin\(helpers\)/);

    // --no-admin keeps a module out of the panel
    assert.equal(cli(project, "add", "customers", "name:string", "--no-admin", "--skip-install").code, 0);
    assert.equal(exists(project, "src", "modules", "customers", "customers.admin.js"), false);
    assert.doesNotMatch(read(project, "src", "admin", "resources.js"), /customers/);

    assertValidJs(project);
  });

  test("file, image and ref fields: upload boxes and links between modules", () => {
    const project = createProject("admin-fields");
    cli(project, "add-auth", "--skip-install");
    cli(project, "add-admin", "--skip-install");
    assert.equal(cli(project, "add", "customers", "name:string", "--skip-install").code, 0);
    const result = cli(project, "add", "orders", "customer:ref:customers", "photo:image", "receipt:file", "--skip-install");
    assert.equal(result.code, 0, result.err);

    const admin = read(project, "src", "modules", "orders", "orders.admin.js");
    assert.match(admin, /module\.exports = \(\{ zodHooks, uploadFile \}\)/);
    assert.match(admin, /features: \[uploadFile\('photo', \{ images: true \}\), uploadFile\('receipt'\)\]/);
    assert.match(admin, /editProperties: \['customer', 'photoFile', 'receiptFile'\]/);
    assert.match(admin, /filterProperties: \['customer', 'createdAt'\]/);

    const model = read(project, "src", "modules", "orders", "orders.model.js");
    assert.match(model, /type: mongoose\.Schema\.Types\.ObjectId,\n\s+ref: 'Customer'/);
    const validation = read(project, "src", "modules", "orders", "orders.validation.js");
    assert.match(validation, /photo: z\.string\(\)\.trim\(\)\.min\(1\)\.nullish\(\)/);

    assert.ok(JSON.parse(read(project, "package.json")).dependencies["@adminjs/upload"]);
    assertValidJs(project);
  });

  test("a database added later gets its admin adapter", () => {
    const project = createProject("admin-add-db");
    cli(project, "add-auth", "--skip-install");
    assert.equal(cli(project, "add-admin", "--skip-install").code, 0);
    assert.equal(cli(project, "add-db", "reports", "--type", "mysql", "--skip-install").code, 0);

    const pkg = JSON.parse(read(project, "package.json"));
    assert.ok(pkg.dependencies["@adminjs/sequelize"]);
  });

  test("add stops before writing anything when the admin markers are gone", () => {
    const project = createProject("admin-markers");
    cli(project, "add-auth", "--skip-install");
    cli(project, "add-admin", "--skip-install");
    const resources = path.join(project, "src", "admin", "resources.js");
    fs.writeFileSync(resources, read(resources).replace("// ADMIN_RESOURCES", ""));

    const result = cli(project, "add", "products", "--skip-install");
    assert.equal(result.code, 1);
    assert.match(result.err, /ADMIN_RESOURCES/);
    assert.equal(exists(project, "src", "modules", "products"), false);
  });
});
