# Express Modular Generator

A modern command-line tool to generate Express.js applications with clean MVC architecture, in JavaScript or TypeScript, with one or many databases.

## ✨ Features

- 🏗️ **Modular MVC Architecture** - Clean separation of concerns
- 🟦 **JavaScript or TypeScript** - Pick the language when you create the project
- 🗄️ **MongoDB, PostgreSQL, MySQL** - Mongoose for MongoDB, Sequelize for SQL
- 🔀 **Multiple Databases** - Connect several databases in one project, even of different kinds
- 🔒 **Security Ready** - CORS, Helmet, and error handling built-in
- ⚡ **Zero Configuration** - Ready to run with minimal setup
- 📦 **Modular Design** - Easy to add and manage modules

## 📋 Installation

```bash
npm install -g express-mod-cli
```

Requires Node.js 18.3 or newer.

## 🚀 Quick Start

### Create a new project

```bash
# JavaScript + MongoDB (the defaults)
express-mod-cli create my-project

# TypeScript + PostgreSQL
express-mod-cli create my-project --ts --db postgres

cd my-project
npm run dev
```

### Add modules to your project

```bash
express-mod-cli add users
express-mod-cli add products
express-mod-cli add order-items
```

### Connect another database

```bash
express-mod-cli add-db analytics --type postgres
express-mod-cli add reports --db analytics
```

## 📖 Commands

| Command                 | Description                                | Example                                         |
| ----------------------- | ------------------------------------------ | ----------------------------------------------- |
| `create <project-name>` | Create a new Express project               | `express-mod-cli create my-app --ts`            |
| `add <module-name>`     | Add a new module to the current project    | `express-mod-cli add users`                     |
| `add-db <name>`         | Add a database connection to the project   | `express-mod-cli add-db analytics --type mysql` |
| `--help` or `-h`        | Show help information                      | `express-mod-cli --help`                        |
| `--version` or `-v`     | Show version number                        | `express-mod-cli --version`                     |

### Options

| Command  | Option                 | Description                                                                |
| -------- | ---------------------- | -------------------------------------------------------------------------- |
| `create` | `--db <type>`          | `mongodb` (default), `postgres` or `mysql`                                 |
| `create` | `--ts`, `--typescript` | Generate a TypeScript project                                              |
| `create` | `--js`, `--javascript` | Generate a JavaScript project (default)                                    |
| `create` | `--skip-install`       | Don't run `npm install`                                                    |
| `add`    | `--db <connection>`    | The database connection the module uses (default: `default`)               |
| `add-db` | `--type <type>`        | `mongodb`, `postgres` or `mysql` (default: same as the default connection) |
| `add-db` | `--skip-install`       | Don't run `npm install` for newly needed packages                          |

Module names may contain letters, numbers, `-` and `_` (`users`, `user-profile`, `order_items`).
`add` and `add-db` detect the project's language from `.expressmodrc.json`, so there is no language flag for them.

## 🟦 JavaScript and TypeScript

|                | JavaScript (default)  | TypeScript (`--ts`)                    |
| -------------- | --------------------- | -------------------------------------- |
| Source files   | `src/**/*.js`         | `src/**/*.ts`                          |
| `npm run dev`  | `nodemon src/index.js` | `tsx watch src/index.ts`              |
| `npm run build` | -                    | `tsc` (output in `dist/`)              |
| `npm start`    | `node src/index.js`   | `node dist/index.js` (run build first) |
| Extra          | -                     | `npm run typecheck`, `tsconfig.json`   |

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

For SQL databases, the tables of your models are created on startup if they don't exist yet (`sequelize.sync()`).
Existing tables are never altered - use migrations for schema changes. The database itself must already exist.

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
4. Installs the packages the database needs

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
express-mod-cli add reports --db analytics   # Sequelize model on "analytics"
express-mod-cli add users                    # Mongoose model on "default"
```

Each model is bound to its connection, so you can also move one by hand:

```javascript
// MongoDB
const { getMongoConnection } = require("../../config/mongodb");
const UsersModel = getMongoConnection("default").model("Users", usersSchema);

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
│   │   └── errorHandler.js       # Global error handling
│   ├── modules/                  # Your business modules
│   │   └── users/
│   │       ├── users.model.js      # Schema & model
│   │       ├── users.controller.js # Business logic
│   │       └── users.routes.js     # Express routes
│   ├── utils/                    # Utility functions
│   └── index.js                  # Main server file
├── .env                          # Environment variables (git-ignored)
├── .env.example                  # Documents the environment variables
├── .expressmodrc.json            # Project setup, read by "add" and "add-db"
├── .gitignore
└── package.json
```

TypeScript projects have the same layout with `.ts` files, plus `tsconfig.json` and `src/config/env.ts`.

> **Keep the marker comments.** `add` and `add-db` insert code below `// ROUTE_IMPORTS`, `// ROUTE_MIDDLEWARE`,
> `// DB_CONNECTIONS`, `// DB_DRIVER_IMPORTS` and `// DB_DRIVERS`. If one is missing, the command stops and tells you which.

## 📦 Module Architecture

Each module generates exactly **3 files** following MVC pattern. This is `express-mod-cli add users` in a JavaScript + MongoDB project:

### 🔹 Model (`users.model.js`)

```javascript
const mongoose = require("mongoose");
const { getMongoConnection } = require("../../config/mongodb");

const usersSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  { timestamps: true }
);

const UsersModel = getMongoConnection("default").model("Users", usersSchema);

module.exports = UsersModel;
```

On a PostgreSQL / MySQL connection the model is a Sequelize model with the same fields.

### 🔹 Controller (`users.controller.js`)

```javascript
const UsersModel = require("./users.model");

async function getAll(req, res, next) {
  try {
    const items = await UsersModel.find().sort({ createdAt: -1 });

    res.json({
      success: true,
      data: items,
      message: "Users retrieved successfully",
    });
  } catch (error) {
    next(error);
  }
}
// ... getById, create, update, remove
```

### 🔹 Routes (`users.routes.js`)

```javascript
const express = require("express");
const router = express.Router();
const usersController = require("./users.controller");

router.get("/", usersController.getAll);
router.get("/:id", usersController.getById);
router.post("/", usersController.create);
router.patch("/:id", usersController.update);
router.delete("/:id", usersController.remove);

module.exports = router;
```

## 🔗 API Endpoints

Each generated module provides RESTful API endpoints:

| Method   | Endpoint        | Description     | Response                                         |
| -------- | --------------- | --------------- | ------------------------------------------------ |
| `GET`    | `/{module}`     | Get all items   | `{ success: true, data: [...], message: "..." }` |
| `GET`    | `/{module}/:id` | Get one item    | `{ success: true, data: {...}, message: "..." }` |
| `POST`   | `/{module}`     | Create new item | `{ success: true, data: {...}, message: "..." }` |
| `PATCH`  | `/{module}/:id` | Update item     | `{ success: true, data: {...}, message: "..." }` |
| `DELETE` | `/{module}/:id` | Delete item     | `{ success: true, data: {...}, message: "..." }` |

Errors always have the shape `{ success: false, message: "..." }`:

| Status | When                                              |
| ------ | ------------------------------------------------- |
| `400`  | Validation failed, malformed id or malformed JSON |
| `404`  | Record or route not found                         |
| `409`  | A unique value already exists                     |
| `500`  | Unexpected error (details hidden in production)   |

### 🔍 Example API Usage

```bash
# Get all users
curl http://localhost:5000/users

# Get specific user
curl http://localhost:5000/users/60d5ec49f1b2c8b1f8e4e1a1

# Create new user
curl -X POST http://localhost:5000/users \
  -H "Content-Type: application/json" \
  -d '{"name": "John Doe", "description": "Software Developer"}'

# Update user
curl -X PATCH http://localhost:5000/users/60d5ec49f1b2c8b1f8e4e1a1 \
  -H "Content-Type: application/json" \
  -d '{"status": "inactive"}'
```

## 🛠️ Technology Stack

Generated projects pin a major version of each dependency (never `latest`), so a new major release can't break a fresh project.

### Core Dependencies

- **Express.js 5.x** - Fast, unopinionated web framework
- **dotenv 18.x** - Environment variable management
- **CORS 2.x** - Cross-origin resource sharing
- **Helmet 8.x** - Security middleware

### Database (only what the project uses)

- **Mongoose 9.x** - MongoDB object modeling
- **Sequelize 6.x** - SQL ORM, with **pg 8.x** (PostgreSQL) or **mysql2 3.x** (MySQL)

### Development Dependencies

- JavaScript: **Nodemon 3.x**
- TypeScript: **TypeScript 7.x**, **tsx 4.x**, and type definitions for Node, Express and CORS

## 🏃‍♂️ Development Workflow

1. **Create Project:**

   ```bash
   express-mod-cli create my-ecommerce-app --ts
   cd my-ecommerce-app
   ```

2. **Configure Database:**

   ```bash
   # Edit .env file
   MONGODB_URI=mongodb://localhost:27017
   DB_NAME=ecommerce_db
   ```

3. **Add Business Modules:**

   ```bash
   express-mod-cli add products
   express-mod-cli add categories
   express-mod-cli add orders
   express-mod-cli add customers
   ```

4. **Start Development:**
   ```bash
   npm run dev
   ```

## 🎯 Best Practices

### Model Customization

After generating a module, customize the schema:

```javascript
// Example: Enhanced User model
const usersSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true, minlength: 6 },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    profile: {
      avatar: String,
      bio: String,
      phone: String,
    },
  },
  { timestamps: true }
);
```

### Controller Enhancement

Add business logic to controllers:

```javascript
// Add custom methods
async function getUserByEmail(req, res, next) {
  try {
    const user = await UsersModel.findOne({ email: req.params.email });
    // ... handle response
  } catch (error) {
    next(error);
  }
}
```

The generated `create` and `update` handlers pass `req.body` straight to the model - validate or whitelist the fields before using them for anything sensitive.

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

### v1.2.0 (Latest)

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
- 🧹 The CLI itself now has zero dependencies

Projects created with v1.1.0 keep working with `add`. `add-db` needs a project created with v1.2.0 or newer.

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
