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
- 🔐 **Authentication** - `add-auth` adds accounts, refresh tokens, roles, email verification and password reset; `add --auth` protects a module
- 🔒 **Security Ready** - CORS, Helmet, and error handling built-in

## 📋 Installation

```bash
npm install -g express-mod-cli
```

Requires Node.js 18.3 or newer (generated TypeScript projects run their tests with Node.js 21 or newer, and `add-auth` needs Node.js 20 or newer for Nodemailer).

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

### Add authentication and an admin panel

```bash
express-mod-cli add-auth                               # /auth/register, /auth/login, ...
express-mod-cli add-admin                              # Admin panel at /admin (needs add-auth)
express-mod-cli add orders total:number --auth         # only for logged-in users
express-mod-cli add reports title:string --role admin  # only for admins
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
| `add-auth`                      | Add authentication to the project          | `express-mod-cli add-auth`                      |
| `add-admin`                     | Add an admin panel (needs `add-auth`)      | `express-mod-cli add-admin`                     |
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
| `add`           | `--auth`               | Every route needs a logged-in user (after `add-auth`)                      |
| `add`           | `--role <role>`        | Every route needs a logged-in user with this role, e.g. `admin`            |
| `add-db`        | `--type <type>`        | `mongodb`, `postgres` or `mysql` (default: same as the default connection) |
| `add-db`        | `--skip-install`       | Don't run `npm install` for newly needed packages                          |
| `add-migration` | `--db <connection>`    | The SQL connection the migration belongs to (default: `default`)           |
| `add-auth`      | `--db <connection>`    | The connection that stores users (default: `default`)                      |
| `add-auth`      | `--skip-install`       | Don't run `npm install` for the new packages                               |
| `add-admin`     | `--path <path>`        | Web path for the admin panel (default: `/admin`)                           |
| `add-admin`     | `--role <role>`        | Role that may log in (default: `admin`, must be a role of the User model)  |
| `add-admin`     | `--theme <theme>`      | Default theme, see [Themes](#themes) (default: `classic`)                  |
| `add-admin`     | `--skip-install`       | Don't run `npm install` for the new packages                               |

When `create` runs in a terminal, it asks for whatever was not given on the command line (Enter picks the default).
In scripts and CI it never asks: pass `--ts`/`--js` and `--db`, or `-y` for the defaults.

`add`, `add-db`, `add-migration` and `add-auth` detect the project's language from `.expressmodrc.json`, so there is no language flag for them.

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
| `file`     | String  | `VARCHAR(255)` | the path of an uploaded file (always optional) |
| `image`    | String  | `VARCHAR(255)` | like `file`; the admin panel accepts images only |
| `ref:<module>` | ObjectId (`ref`) | `INTEGER` + foreign key | the id of a record of that module |

A `ref` field links two modules, e.g. `customer:ref:customers`; the other module must already exist on the same connection
(or be the module itself, e.g. `parent:ref:categories:optional`). A record that a required link points to can't be deleted (the admin panel says which records to change first);
an optional link to a deleted record is cleared.
`file` and `image` fields get an upload box in the [admin panel](#%EF%B8%8F-admin-panel).

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

## 🔐 Authentication

```bash
express-mod-cli add-auth [--db <connection>]
```

adds email + password accounts with short-lived access tokens, rotating refresh tokens, email verification and password reset:

| Method | Endpoint                | Body                                  | Needs access token |
| ------ | ----------------------- | ------------------------------------- | ------------------ |
| `POST` | `/auth/register`        | `email`, `password`, `name` (optional) | -                  |
| `POST` | `/auth/login`           | `email`, `password`                   | -                  |
| `POST` | `/auth/refresh`         | - (cookie) or `refreshToken`          | -                  |
| `POST` | `/auth/logout`          | - (cookie) or `refreshToken`          | -                  |
| `POST` | `/auth/logout-all`      | -                                     | yes                |
| `GET`  | `/auth/me`              | -                                     | yes                |
| `POST` | `/auth/change-password` | `currentPassword`, `newPassword`      | yes                |
| `POST` | `/auth/verify-email`    | `token` (from the email)              | -                  |
| `POST` | `/auth/resend-verification` | `email`                           | -                  |
| `POST` | `/auth/forgot-password` | `email`                               | -                  |
| `POST` | `/auth/reset-password`  | `token` (from the email), `newPassword` | -                |

### How it works

- **Register / login** return an **access token** (JWT, 15 minutes) in the body and set a **refresh token** (30 days) as an `httpOnly` cookie that only `/auth` receives, so page scripts can't read it.
- Send the access token with every request: `Authorization: Bearer <accessToken>`.
- When it expires (`401`), call `POST /auth/refresh`: the cookie is exchanged for a new access token **and a new refresh token**. The old one stops working.
- If an old refresh token is used again, someone may have copied it: that whole login ends, and the user has to log in again.
- **Logout** ends one login, **logout-all** every login of the user, and **change-password** ends every other login.

```javascript
// In the browser
const login = await fetch("/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "include", // store the refresh token cookie
  body: JSON.stringify({ email, password }),
});
const { data } = await login.json();

const me = await fetch("/auth/me", { headers: { Authorization: `Bearer ${data.accessToken}` } });

// Later, when a request returns 401
const refreshed = await fetch("/auth/refresh", { method: "POST", credentials: "include" });
```

Mobile apps that can't keep cookies: set `AUTH_REFRESH_IN_BODY=true` to also get the refresh token in the body, and send it back as `{ "refreshToken": "..." }`.

### Email verification and password reset

1. **Register** sends an email with a link to `APP_URL/verify-email?token=...`. Your frontend page reads the token and calls `POST /auth/verify-email { token }`. Afterwards `/auth/me` shows `"emailVerified": true`.
2. **Forgot password:** `POST /auth/forgot-password { email }` emails a link to `APP_URL/reset-password?token=...`. That page asks for a new password and calls `POST /auth/reset-password { token, newPassword }`. Every login of the user ends; they log in with the new password.

- Links work once, verification links for 24 hours and reset links for 60 minutes. A new email makes the previous link of that kind stop working.
- `forgot-password` and `resend-verification` give the same answer whether or not the account exists, and send the email in the background, so they don't reveal which addresses are registered.
- Resetting the password also verifies the address (the user opened the email).
- With `AUTH_REQUIRE_VERIFIED_EMAIL=true`, register doesn't log the user in, and login answers `403` with `"code": "EMAIL_NOT_VERIFIED"` until the address is verified (`POST /auth/resend-verification { email }` sends a new link).
- Change the emails' wording in `src/modules/auth/auth.emails.js`.

**Sending emails:** set `SMTP_HOST` (and `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`) in `.env` - any SMTP provider works (Gmail, SendGrid, Mailgun, Amazon SES, ...).
Until then, development prints every email, link included, to the console. In production without `SMTP_HOST` the server only logs that the email was not sent.

### Protecting modules and roles

```bash
express-mod-cli add orders total:number --auth         # router.use(requireAuth)
express-mod-cli add reports title:string --role admin  # router.use(requireRole('admin'))
```

In your own routes, `req.user` is `{ id, role }`:

```javascript
const { requireAuth, requireRole } = require("../../middleware/auth");

router.get("/mine", requireAuth, controller.listMine);        // any logged-in user
router.delete("/:id", requireRole("admin"), controller.remove); // admins only
```

New accounts get the role `user`; clients can't choose it. Make the first admin with:

```bash
npm run auth:set-role -- you@example.com admin
```

### Settings (`.env`)

| Variable                 | Default    | Meaning                                                              |
| ------------------------ | ---------- | -------------------------------------------------------------------- |
| `JWT_SECRET`             | (random)   | Signs access tokens; at least 32 characters. `add-auth` generates one |
| `JWT_ACCESS_EXPIRES_IN`  | `15m`      | Access token lifetime                                                |
| `REFRESH_TOKEN_DAYS`     | `30`       | How long a login lasts without activity                              |
| `AUTH_REFRESH_IN_BODY`   | `false`    | Also return the refresh token in response bodies                     |
| `AUTH_COOKIE_SAMESITE`   | `lax`      | `none` for a frontend on another site (needs HTTPS)                  |
| `AUTH_RATE_LIMIT`        | `20`       | Login / register / password attempts per IP per 15 minutes, per route |
| `APP_URL`                | `http://localhost:3000` | Frontend address used in email links                    |
| `AUTH_REQUIRE_VERIFIED_EMAIL` | `false` | Refuse logins until the email address is verified                  |
| `AUTH_EMAIL_RATE_LIMIT`  | `5`        | Emails one client can trigger per 15 minutes                         |
| `MAIL_FROM`              | -          | Sender, e.g. `"My App <no-reply@myapp.com>"`                         |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` | - | SMTP server; `SMTP_SECURE=true` for port 465 |

**Frontend on another domain:** set `AUTH_COOKIE_SAMESITE=none`, serve over HTTPS, and allow credentials for that origin in `src/app`: `app.use(cors({ origin: "https://app.example.com", credentials: true }))`.
**Behind a proxy** (Nginx, Heroku, ...): add `app.set("trust proxy", 1)` so rate limiting sees the client's IP.

### Security details

- Passwords are hashed with bcrypt (12 rounds); 8 characters minimum, 72 bytes maximum.
- Refresh tokens and email tokens are random and stored only as SHA-256 hashes; MongoDB removes expired ones with a TTL index.
- Login gives the same answer, in about the same time, for an unknown email and a wrong password.
- Access tokens can't be revoked before they expire (that's what keeps them fast); keep `JWT_ACCESS_EXPIRES_IN` short.
- Email tokens are bound to their purpose: a reset token can't verify an address and vice versa.

## 🛡️ Admin Panel

`express-mod-cli add-admin` adds a Django-style admin panel, built on [AdminJS](https://adminjs.co). Run `add-auth` first: the panel uses its users.

```bash
express-mod-cli add-auth
express-mod-cli add-admin                       # or: --path /backoffice --theme dark
npm run dev                                     # open http://localhost:5000/admin
```

- **Every module**: list, search, filter, sort, create, edit and delete records. Modules added later with `add` appear automatically (`--no-admin` keeps one out).
- **Same rules as the API**: forms are checked with the module's Zod schemas, so the panel can't save what `POST /products` would reject.
- **Users**: create users with a password, change roles, reset passwords (the user is logged out everywhere). Password hashes are never sent to the browser, and an admin can't remove their own admin role or delete their own account.
- **Home page** with every module, its number of records and Add / Change links, and your recent actions; themes to switch in the user menu (top right, remembered per browser); English and Bangla.
- **Admin log**: every add, change, delete and import - who, when, which record and which fields (never the values).
- **Export / Import** on every page: CSV or JSON. Export follows the list's filters and leaves out hidden fields; every imported row is checked like the "Create new" form, failed rows are listed, and each imported record is in the admin log.
  A file or image column holds the path of a file already in `uploads/` (what Export writes) - a CSV can't carry the files themselves.
- **Uploads**: `file` and `image` fields get an upload box. Files are kept in `uploads/` and served at `/uploads` (type and size are checked on the server; uploaded files can't run scripts).
- **Links between modules**: `ref` fields become a searchable select, and the panel checks the record exists.
- **Forgot your password?** on the login page: admins and staff get a reset link by email (uses the `add-auth` mail settings).
- **Logins end** when the user is deleted, loses the role, or gets a new password (checked every 30 seconds).

### Roles

| Role    | Can                                                                                   |
| ------- | ------------------------------------------------------------------------------------- |
| `admin` | everything                                                                            |
| `staff` | view, add, edit and export module records - not delete, import, or open Users / Admin log |

`add-admin` adds `staff` to the roles of the User model. Give a user a role on the Users page or with `npm run auth:set-role -- <email> staff`.

### Themes

Every user picks a theme in the user menu (top right); `ADMIN_THEME` is the one used until then (`add-admin --theme`).

| Theme                          | Look                                                                       |
| ------------------------------ | -------------------------------------------------------------------------- |
| `classic`, `classic-dark`      | Like Django's admin: blue band and yellow title, a table per section with Add / Change, recent actions (default) |
| `modern`, `modern-dark`        | Number cards, an activity chart (last 14 days), records per module, rounded cards |
| `light`, `dark`                | AdminJS's own look                                                         |
| `top-menu`                     | No sidebar: the sections are menus in the top bar                          |

A theme is its colours in `src/admin/themes` and a stylesheet in `src/admin/themes/<id>.css`.
For your own theme, copy a stylesheet, add an entry to `src/admin/themes` and its id to `THEME_IDS`.
The login and password reset pages are dark when a dark theme is chosen.

### The first admin

`add-admin` writes a first admin to `.env` and prints it:

```
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=<random>
```

That user is created on the first start, while the database has no admin yet. Log in and change the password (Users). More admins, or an existing user made an admin:

```bash
npm run admin:create -- jane@example.com                 # new user: prints a random password
npm run admin:create -- jane@example.com 'Pass-word-1' 'Jane Doe'
```

### Files

| File                                       | What it does                                                          |
| ------------------------------------------ | --------------------------------------------------------------------- |
| `src/admin/admin.config`                   | Path, role, title, theme, language, session length                   |
| `src/admin/resources`                      | Everything in the sidebar; `add` registers modules here               |
| `src/modules/<module>/<module>.admin`      | How a module looks: columns, filters, form fields, validation        |
| `src/admin/users.resource`                 | The Users page                                                        |
| `src/admin/translations`                   | Texts and labels (`en`, `bn`)                                         |
| `src/admin/permissions`                    | What admin and staff may do                                           |
| `src/admin/auditLog`, `src/admin/adminLog` | The admin log                                                         |
| `src/admin/uploads`                        | Where uploaded files are kept and how they are served                 |
| `src/admin/components/`                    | The home, login, export and import pages (React)                      |

Modules created before `add-admin` get an admin file without a field list: the fields are read from the model.

### Settings (`.env`)

| Variable              | Meaning                                                            |
| --------------------- | ------------------------------------------------------------------ |
| `ADMIN_COOKIE_SECRET` | Signs the login cookie (random, at least 32 characters)            |
| `ADMIN_TITLE`         | Name shown in the panel and on the login page                      |
| `ADMIN_THEME`         | The theme until a user picks one, see [Themes](#themes)            |
| `ADMIN_LANGUAGE`      | `en` or `bn`                                                       |
| `ADMIN_SESSION_HOURS` | How long a login lasts (default 8)                                 |
| `ADMIN_URL`           | This server's address, for password reset links (default `http://localhost:<PORT>`) |
| `ADMIN_UPLOAD_MAX_MB` | Largest uploaded file (default 10)                                 |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | The first admin, created while there is none            |

Logins are stored in the users' database (`admin_sessions`), and failed logins are limited per IP (`AUTH_RATE_LIMIT` per 15 minutes).
The panel starts after the databases connect; if it can't start, the API keeps running and `/admin` answers `503`.
In production set `NODE_ENV=production` (the panel's components are built once on startup) and, behind an HTTPS proxy, `app.set('trust proxy', 1)`.

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
│   │   ├── auth.js               # requireAuth / requireRole (add-auth)
│   │   ├── errorHandler.js       # Global error handling
│   │   └── validate.js           # Runs a module's Zod schema on the request body
│   ├── migrations/<connection>/  # SQL migrations
│   ├── modules/                  # Your business modules
│   │   ├── auth/                 # Users, refresh tokens, /auth routes (add-auth)
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

### v1.5.0 (Latest)

- `add-admin`: admin panel for every module, with users and roles, a first admin user from `.env` and `npm run admin:create`
- Admin forms use the modules' Zod schemas; password hashes are never sent to the browser
- `add --no-admin`; `add` and `add-db` keep the panel's packages up to date
- Admin log and recent actions, `staff` role, CSV/JSON export and import, file uploads, password reset from the login page
- New field types: `file`, `image` and `ref:<module>` (links between modules, with foreign keys in SQL)

### v1.4.0

- 🔐 **Authentication** - new `add-auth` command: register, login, refresh token rotation with reuse detection, logout, logout from all devices, current user, change password
- 📧 **Email verification and password reset** - one-time links by email (Nodemailer, any SMTP provider; printed to the console in development), optional `AUTH_REQUIRE_VERIFIED_EMAIL`
- 🛡️ **Protected modules** - `add <module> --auth` and `--role <role>`; `requireAuth` / `requireRole` middleware for your own routes
- 👑 `npm run auth:set-role` to make the first admin
- Works with JavaScript and TypeScript, MongoDB, PostgreSQL and MySQL, and with users on any connection
- 🧹 New projects no longer get a placeholder `JWT_SECRET` in `.env`; `add-auth` replaces the placeholder in older projects

### v1.3.0

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
