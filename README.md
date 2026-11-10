# Express Modular Generator

A modern command-line tool to generate Express.js applications with clean MVC architecture, in JavaScript or TypeScript, with one or many databases.

## ✨ Features

- 🏗️ **Modular MVC Architecture** - Clean separation of concerns
- 🟦 **JavaScript or TypeScript** - Pick the language when you create the project
- 🗄️ **MongoDB, PostgreSQL, MySQL** - Mongoose for MongoDB, Sequelize for SQL
- 🔀 **Multiple Databases** - Connect several databases in one project, even of different kinds
- 🧩 **Your own fields** - `add products name:string price:number` generates the schema, validation and migration
- ✅ **Request validation** - Zod schemas for every module; unknown fields never reach the database
- 📄 **Pagination, sorting, search** - `?page=2&limit=20&sort=-price&search=phone` on every list endpoint
- 🔁 **SQL migrations** - Tables are created and changed by migrations, not `sync()`
- 🧪 **Test-ready** - `npm test` works from the first minute, no database needed
- 🔒 **Security Ready** - CORS, Helmet, and error handling built-in

## 📋 Installation

```bash
npm install -g express-mod-cli
```

Requires Node.js 18.3 or newer (generated TypeScript projects run their tests with Node.js 21 or newer).

## 🚀 Quick Start

### Create a new project

```bash
# Asks for the name, language and database
express-mod-cli create

# Or give everything up front
express-mod-cli create my-project --ts --db postgres

cd my-project
npm run dev
```

### Add modules to your project

```bash
express-mod-cli add users                                   # default fields
express-mod-cli add products name:string price:number stock:integer:default=0
express-mod-cli add order-items quantity:integer status:enum:pending,shipped:default=pending
```

### Connect another database

```bash
express-mod-cli add-db analytics --type postgres
express-mod-cli add reports title:string --db analytics
```

## 📖 Commands

| Command                         | Description                                | Example                                         |
| ------------------------------- | ------------------------------------------ | ----------------------------------------------- |
| `create [project-name]`         | Create a new Express project               | `express-mod-cli create my-app --ts`            |
| `add <module-name> [fields...]` | Add a module to the current project        | `express-mod-cli add users name:string`         |
| `add-db <name>`                 | Add a database connection to the project   | `express-mod-cli add-db analytics --type mysql` |
| `add-migration <name>`          | Add an empty migration to a SQL connection | `express-mod-cli add-migration add-phone`       |
| `--help` or `-h`                | Show help information                      | `express-mod-cli --help`                        |
| `--version` or `-v`             | Show version number                        | `express-mod-cli --version`                     |

### Options

| Command         | Option                 | Description                                                                |
| --------------- | ---------------------- | -------------------------------------------------------------------------- |
| `create`        | `--db <type>`          | `mongodb`, `postgres` or `mysql`                                           |
| `create`        | `--ts`, `--typescript` | Generate a TypeScript project                                              |
| `create`        | `--js`, `--javascript` | Generate a JavaScript project                                              |
| `create`        | `-y`, `--yes`          | Don't ask; use JavaScript + MongoDB for anything not given                 |
| `create`        | `--skip-install`       | Don't run `npm install`                                                    |
| `add`           | `--db <connection>`    | The database connection the module uses (default: `default`)               |
| `add`           | `--skip-install`       | Don't run `npm install` when the project needs a new package               |
| `add-db`        | `--type <type>`        | `mongodb`, `postgres` or `mysql` (default: same as the default connection) |
| `add-db`        | `--skip-install`       | Don't run `npm install` for newly needed packages                          |
| `add-migration` | `--db <connection>`    | The SQL connection the migration belongs to (default: `default`)           |

When `create` runs in a terminal, it asks for whatever was not given on the command line (Enter picks the default).
In scripts and CI it never asks: pass `--ts`/`--js` and `--db`, or `-y` for the defaults.

`add`, `add-db` and `add-migration` detect the project's language from `.expressmodrc.json`, so there is no language flag for them.

## 🧩 Fields

Describe a module's fields after its name:

```bash
express-mod-cli add products name:string:unique price:number stock:integer:default=0 \
  status:enum:draft,published:default=draft releasedAt:date:optional
```

Format: `<name>:<type>[:optional][:unique][:default=<value>]`

| Type       | MongoDB | SQL            | Request body                   |
| ---------- | ------- | -------------- | ------------------------------ |
| `string`   | String  | `VARCHAR(255)` | non-empty text                 |
| `text`     | String  | `TEXT`         | non-empty text                 |
| `number`   | Number  | `DOUBLE`       | number                         |
| `integer`  | Number  | `INTEGER`      | whole number                   |
| `boolean`  | Boolean | `BOOLEAN`      | `true` / `false`               |
| `date`     | Date    | `DATETIME`     | date string, e.g. `2026-01-31` |
| `enum:a,b` | String  | `VARCHAR(255)` | one of the listed values       |

| Option        | Meaning                                              |
| ------------- | ---------------------------------------------------- |
| _(none)_      | Required when creating a record                      |
| `optional`    | May be left out or `null`                            |
| `unique`      | Unique index (duplicates return `409`)               |
| `default=<v>` | Value used when left out (not for `text` and `date`) |

Short type names work too: `int`, `float`, `bool`, `str`.
Without fields, a module gets `name:string description:text:optional status:enum:active,inactive:default=active`.
`id`, `createdAt` and `updatedAt` are added automatically.

## ✅ Validation

Each module has a `<module>.validation.js` with [Zod](https://zod.dev) schemas built from its fields. The routes run them before the controller:

```javascript
router.post("/", validate(createProductSchema), productsController.create);
router.patch("/:id", validate(updateProductSchema), productsController.update);
```

- Fields that the schema does not list are removed, so a client can't set e.g. `role` or `id`.
- `PATCH` accepts any subset of the fields, but at least one.
- Invalid requests get a `400` naming every problem:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    { "field": "price", "message": "Invalid input: expected number, received string" },
    { "field": "status", "message": "Invalid option: expected one of \"draft\"|\"published\"" }
  ]
}
```

## 📄 Pagination, Sorting and Search

Every `GET /<module>` accepts:

| Query    | Example               | Default      |
| -------- | --------------------- | ------------ |
| `page`   | `?page=2`             | `1`          |
| `limit`  | `?limit=50` (max 100) | `20`         |
| `sort`   | `?sort=-price,name`   | `-createdAt` |
| `search` | `?search=phone`       | -            |

`-` sorts descending; several fields are separated by commas. Only the module's own fields (plus `createdAt`, `updatedAt` and, for SQL, `id`) can be sorted on.
`search` looks for the text, case-insensitively, in the module's `string` and `text` fields.

```json
{
  "success": true,
  "data": [],
  "pagination": { "page": 2, "limit": 20, "total": 41, "totalPages": 3 },
  "message": "Products retrieved successfully"
}
```

## 🔁 SQL Migrations

PostgreSQL and MySQL tables are managed by migrations ([Umzug](https://github.com/sequelize/umzug)), one folder per connection:

```
src/migrations/
├── default/
│   ├── 20260131094500-create-products.js     # written by "add products ..."
│   └── 20260202120000-add-phone-to-users.js  # written by "add-migration add-phone-to-users"
└── analytics/
    └── ...
```

- `add` writes the migration that creates the module's table.
- `add-migration <name> [--db <connection>]` writes an empty one for your own changes (new column, index, ...).
- Pending migrations run when the server starts. Set `DB_AUTO_MIGRATE=false` to run them yourself, e.g. as a deploy step.

```bash
npm run migrate                      # apply pending migrations
npm run migrate:down -- analytics    # undo the last migration of a connection
npm run migrate:status               # applied and pending migrations
```

When you change a table with a migration, update the module's model and validation to match.
Applied migrations are recorded in the `SequelizeMeta` table. The database itself must already exist.

## 🧪 Tests

Generated projects come with [supertest](https://github.com/ladjs/supertest) and Node's built-in test runner:

```bash
npm test
```

`tests/app.test.js` checks the 404 and malformed-JSON handling, and every `add` writes `tests/<module>.test.js` with validation tests.
They import `src/app`, which builds the Express app without connecting to a database or opening a port, so they run anywhere, including CI.

## 🟦 JavaScript and TypeScript

|                 | JavaScript (default)   | TypeScript (`--ts`)                    |
| --------------- | ---------------------- | -------------------------------------- |
| Source files    | `src/**/*.js`          | `src/**/*.ts`                          |
| `npm run dev`   | `nodemon src/index.js` | `tsx watch src/index.ts`               |
| `npm run build` | -                      | `tsc` (output in `dist/`)              |
| `npm start`     | `node src/index.js`    | `node dist/index.js` (run build first) |
| `npm test`      | `node --test`          | `tsx --test`                           |
| Extra           | -                      | `npm run typecheck`, `tsconfig.json`   |

In a built TypeScript project, migrations run without tsx: `node dist/scripts/migrate.js up`.

## 🗄️ Database Configuration

Each project has a **default** connection, chosen with `create --db`:

| `--db`     | Library   | `.env` variables         |
| ---------- | --------- | ------------------------ |
| `mongodb`  | Mongoose  | `MONGODB_URI`, `DB_NAME` |
| `postgres` | Sequelize | `DATABASE_URL`           |
| `mysql`    | Sequelize | `DATABASE_URL`           |

```env
# MongoDB (local or Atlas)
MONGODB_URI=mongodb://localhost:27017
DB_NAME=my_project_db

# PostgreSQL
DATABASE_URL=postgres://user:password@localhost:5432/my_project_db

# MySQL
DATABASE_URL=mysql://user:password@localhost:3306/my_project_db
```

A `.env.example` with the same variables is generated next to `.env` (which is git-ignored).

## 🔀 Multiple Databases

Add as many connections as you need, of any supported kind:

```bash
express-mod-cli add-db analytics --type postgres
express-mod-cli add-db logs --type mongodb
```

`add-db` does everything needed for the new connection:

1. Adds it to `src/config/databases.js`
2. Creates the connection helper (`src/config/mongodb.js` or `src/config/sql.js`) if the project doesn't have it yet
3. Adds the variables to `.env` and `.env.example` (`DB_<NAME>_URI`, plus `DB_<NAME>_NAME` for MongoDB)
4. For the first SQL database: adds the migration runner and the `migrate` scripts
5. Installs the packages the database needs

```javascript
// src/config/databases.js
const databases = {
  // DB_CONNECTIONS
  analytics: {
    type: "postgres",
    uri: process.env.DB_ANALYTICS_URI || "postgres://postgres:postgres@localhost:5432/analytics",
  },
  default: {
    type: "mongodb",
    uri: process.env.MONGODB_URI || "mongodb://localhost:27017",
    dbName: process.env.DB_NAME || "my_project_db",
  },
};
```

Then tell a module which connection to use:

```bash
express-mod-cli add reports title:string --db analytics   # Sequelize model + migration on "analytics"
express-mod-cli add users                                 # Mongoose model on "default"
```

Each model is bound to its connection, so you can also move one by hand:

```javascript
// MongoDB
const { getMongoConnection } = require("../../config/mongodb");
const UserModel = getMongoConnection("default").model("User", userSchema);

// PostgreSQL / MySQL
const { getSqlConnection } = require("../../config/sql");
const sequelize = getSqlConnection("analytics");
```

All connections are opened before the server starts listening and closed on `SIGINT` / `SIGTERM`.

## 🏗️ Generated Project Structure

```
my-project/
├── src/
│   ├── config/
│   │   ├── databases.js          # List of database connections
│   │   ├── db.js                 # Connects / disconnects all of them
│   │   └── mongodb.js / sql.js   # Connection helpers (one per kind of database in use)
│   ├── middleware/
│   │   ├── errorHandler.js       # Global error handling
│   │   └── validate.js           # Runs a module's Zod schema on the request body
│   ├── migrations/<connection>/  # SQL migrations
│   ├── modules/                  # Your business modules
│   │   └── products/
│   │       ├── products.model.js      # Schema & model
│   │       ├── products.validation.js # Zod schemas for create / update
│   │       ├── products.controller.js # Business logic
│   │       └── products.routes.js     # Express routes
│   ├── scripts/migrate.js        # npm run migrate (SQL projects)
│   ├── utils/listQuery.js        # Pagination, sorting and search helpers
│   ├── app.js                    # Express app: middleware and routes
│   └── index.js                  # Connects the databases and starts the server
├── tests/                        # npm test
├── .env                          # Environment variables (git-ignored)
├── .env.example                  # Documents the environment variables
├── .expressmodrc.json            # Project setup, read by "add", "add-db" and "add-migration"
├── .gitignore
└── package.json
```

TypeScript projects have the same layout with `.ts` files, plus `tsconfig.json` and `src/config/env.ts`.

> **Keep the marker comments.** The CLI inserts code below `// ROUTE_IMPORTS`, `// ROUTE_MIDDLEWARE` (in `src/app`),
> `// DB_CONNECTIONS`, `// DB_DRIVER_IMPORTS` and `// DB_DRIVERS`. If one is missing, the command stops and tells you which.

## 📦 Module Architecture

`express-mod-cli add products name:string price:number` in a JavaScript + MongoDB project generates:

### 🔹 Model (`products.model.js`)

```javascript
const mongoose = require("mongoose");
const { getMongoConnection } = require("../../config/mongodb");

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true },
  },
  { timestamps: true }
);

const ProductModel = getMongoConnection("default").model("Product", productSchema);

module.exports = ProductModel;
```

Model names are singular (`Product`), collections and tables plural (`products`). On a PostgreSQL / MySQL connection the model is a Sequelize model with the same fields, plus a migration.

### 🔹 Validation (`products.validation.js`)

```javascript
const { z } = require("zod");

const createProductSchema = z.object({
  name: z.string().trim().min(1),
  price: z.number(),
});

const updateProductSchema = createProductSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update",
  });

module.exports = { createProductSchema, updateProductSchema };
```

### 🔹 Controller (`products.controller.js`)

```javascript
const ProductModel = require("./products.model");
const { escapeRegex, paginate, parseListQuery } = require("../../utils/listQuery");

const SORTABLE_FIELDS = ["name", "price", "createdAt", "updatedAt"];
const SEARCHABLE_FIELDS = ["name"];

async function getAll(req, res, next) {
  try {
    const { page, limit, offset, sort, search } = parseListQuery(req.query, { sortable: SORTABLE_FIELDS });
    const filter = search
      ? { $or: SEARCHABLE_FIELDS.map((field) => ({ [field]: { $regex: escapeRegex(search), $options: "i" } })) }
      : {};

    const [items, total] = await Promise.all([
      ProductModel.find(filter).sort(sort).skip(offset).limit(limit),
      ProductModel.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: items,
      pagination: paginate(total, page, limit),
      message: "Products retrieved successfully",
    });
  } catch (error) {
    next(error);
  }
}
// ... getById, create, update, remove
```

### 🔹 Routes (`products.routes.js`)

```javascript
const express = require("express");
const validate = require("../../middleware/validate");
const productsController = require("./products.controller");
const { createProductSchema, updateProductSchema } = require("./products.validation");

const router = express.Router();

router.get("/", productsController.getAll);
router.get("/:id", productsController.getById);
router.post("/", validate(createProductSchema), productsController.create);
router.patch("/:id", validate(updateProductSchema), productsController.update);
router.delete("/:id", productsController.remove);

module.exports = router;
```

## 🔗 API Endpoints

Each generated module provides RESTful API endpoints:

| Method   | Endpoint        | Description                            | Response                                                            |
| -------- | --------------- | -------------------------------------- | ------------------------------------------------------------------- |
| `GET`    | `/{module}`     | List (paginated, sortable, searchable) | `{ success: true, data: [...], pagination: {...}, message: "..." }` |
| `GET`    | `/{module}/:id` | Get one item                           | `{ success: true, data: {...}, message: "..." }`                    |
| `POST`   | `/{module}`     | Create new item (validated)            | `{ success: true, data: {...}, message: "..." }`                    |
| `PATCH`  | `/{module}/:id` | Update item (validated)                | `{ success: true, data: {...}, message: "..." }`                    |
| `DELETE` | `/{module}/:id` | Delete item                            | `{ success: true, data: {...}, message: "..." }`                    |

Errors always have the shape `{ success: false, message: "..." }` (validation errors add an `errors` list):

| Status | When                                                              |
| ------ | ----------------------------------------------------------------- |
| `400`  | Invalid body, malformed id or JSON, bad `page` / `limit` / `sort` |
| `404`  | Record or route not found                                         |
| `409`  | A unique value already exists                                     |
| `500`  | Unexpected error (details hidden in production)                   |

### 🔍 Example API Usage

```bash
# List, newest first
curl "http://localhost:5000/products?page=1&limit=20"

# Search and sort
curl "http://localhost:5000/products?search=phone&sort=-price"

# Create
curl -X POST http://localhost:5000/products \
  -H "Content-Type: application/json" \
  -d '{"name": "Phone", "price": 499}'

# Update
curl -X PATCH http://localhost:5000/products/60d5ec49f1b2c8b1f8e4e1a1 \
  -H "Content-Type: application/json" \
  -d '{"price": 449}'
```

## 🛠️ Technology Stack

Generated projects pin a major version of each dependency (never `latest`), so a new major release can't break a fresh project.

### Core Dependencies

- **Express.js 5.x** - Fast, unopinionated web framework
- **Zod 4.x** - Request validation
- **dotenv 18.x** - Environment variable management
- **CORS 2.x** - Cross-origin resource sharing
- **Helmet 8.x** - Security middleware

### Database (only what the project uses)

- **Mongoose 9.x** - MongoDB object modeling
- **Sequelize 6.x** - SQL ORM, with **pg 8.x** (PostgreSQL) or **mysql2 3.x** (MySQL)
- **Umzug 3.x** - SQL migrations

### Development Dependencies

- **supertest 7.x** - HTTP tests
- JavaScript: **Nodemon 3.x**
- TypeScript: **TypeScript 7.x**, **tsx 4.x**, and type definitions for Node, Express, CORS and supertest

## 🏃‍♂️ Development Workflow

1. **Create Project:**

   ```bash
   express-mod-cli create my-shop --ts --db postgres
   cd my-shop
   ```

2. **Configure Database:**

   ```bash
   # Edit .env file
   DATABASE_URL=postgres://user:password@localhost:5432/my_shop_db
   ```

3. **Add Business Modules:**

   ```bash
   express-mod-cli add products name:string price:number stock:integer:default=0
   express-mod-cli add categories name:string:unique
   express-mod-cli add orders total:number status:enum:pending,paid,shipped:default=pending
   ```

4. **Start Development:**

   ```bash
   npm run dev     # runs pending migrations, then starts the server
   npm test
   ```

## 🎯 Best Practices

### Changing a model

1. For SQL connections, write a migration: `express-mod-cli add-migration add-phone-to-users`
2. Add the field to the model
3. Add it to the Zod schema in `<module>.validation.js`, or clients can't set it
4. If it should be sortable or searchable, add it to `SORTABLE_FIELDS` / `SEARCHABLE_FIELDS` in the controller

### Controller Enhancement

Add business logic to controllers:

```javascript
async function getByEmail(req, res, next) {
  try {
    const user = await UserModel.findOne({ email: req.params.email });
    // ... handle response
  } catch (error) {
    next(error);
  }
}
```

## 🧪 Developing this CLI

```bash
npm test   # generates projects in a temp directory and checks the output
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 Changelog

### v1.3.0 (Latest)

- 🧩 **Custom fields** - `add <module> name:string price:number ...` with types, `optional`, `unique` and defaults
- ✅ **Validation** - Zod schemas per module; unknown fields are dropped, errors list every invalid field
- 📄 **Pagination, sorting, search** - on every list endpoint
- 🔁 **SQL migrations** - Umzug replaces `sync()`; new `add-migration` command and `migrate` scripts
- 🧪 **Tests in generated projects** - `npm test` with supertest, no database needed; one test file per module
- 💬 **Interactive `create`** - asks for name, language and database when they are not given (`-y` to skip)
- 🔤 **Natural names** - singular models (`Product`), plural tables, messages such as "Category created"
- 🏗️ The Express app moved to `src/app`, so it can be tested without starting the server

Projects created with v1.2.0 keep working: `add` adds the validation and list helpers they lack (and `zod` to package.json).
Their SQL tables are still created by `sync()`; migrations, `add-migration` and generated tests need a project created with v1.3.0.

### v1.2.0

- 🟦 **TypeScript** - `create --ts` generates a fully typed project
- 🗄️ **PostgreSQL & MySQL** - `create --db postgres|mysql` (Sequelize)
- 🔀 **Multiple databases** - new `add-db` command, and `add <module> --db <connection>`
- 🐛 **Bug fixes**
  - Module names with `-` or `_` no longer generate invalid JavaScript
  - `add` never overwrites an existing module or registers its routes twice
  - Module and project names are validated (no more files written outside the project)
  - `add` only runs inside a generated project and stops if a marker comment is missing
  - A failed `npm install` no longer leaves a half-created project
  - Duplicate unique values return 409 instead of 500, and all error responses share one shape
- 🔧 Generated servers shut down gracefully and pin dependency versions instead of `latest`

### v1.1.0

- 🆕 **Mongoose Integration** - Replaced native MongoDB driver with Mongoose ODM
- 🔄 **Modular CLI Architecture** - Refactored CLI into clean, maintainable modules
- ⬆️ **Updated Dependencies** - Latest versions (Express 5.x, Mongoose 8.x)
- 🐛 **Bug Fixes** - Resolved template generation issues
- 📚 **Enhanced Documentation** - Complete API reference and examples

### v1.0.11

- Basic project and module generation
- Native MongoDB driver integration
- Simple MVC structure

## 📞 Support

- 🐛 **Issues**: [GitHub Issues](https://github.com/nizamseu/express-mod-cli/issues)
- 📖 **Documentation**: This README
- 💬 **Discussions**: [GitHub Discussions](https://github.com/nizamseu/express-mod-cli/discussions)

## 📜 License

MIT © [Nizam Uddin](https://github.com/nizamseu)

---

**Made with ❤️ for the Express.js community**
