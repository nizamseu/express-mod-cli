# Admin Panel Plan with AdminJS (`express-mod-cli add-admin`)

An alternative to [admin-panel-plan.md](admin-panel-plan.md) (the hand-written admin). This version
builds the panel on **[AdminJS](https://adminjs.co)** v7 and its official packages.

Status: plan, nothing implemented yet. Several AdminJS details below are from memory of the v7 API
and are marked **(verify)**. Phase 0 is a spike whose only job is to confirm them before any CLI
work starts.

---

## 1. Goal

```bash
express-mod-cli add-auth          # already exists (users, roles, bcrypt)
express-mod-cli add-admin         # new: installs and wires AdminJS
npm run auth:set-role -- me@example.com admin
npm run dev                       # open http://localhost:5000/admin
```

What the admin gets:

| Django admin               | AdminJS                                                              |
| -------------------------- | -------------------------------------------------------------------- |
| Login page                 | AdminJS login page; checked against the `add-auth` users, role `admin` |
| Site administration        | Sidebar navigation (grouped) + dashboard                             |
| Change list                | List with search, sort, filters, pagination, bulk delete (built in)  |
| Add / change form          | Built in, generated from the Mongoose / Sequelize model              |
| Delete confirmation        | Built in                                                             |
| Recent actions             | `@adminjs/logger` + a dashboard component                            |
| Users / Groups             | Users resource: role select, new users with a hashed password        |
| Light / dark               | `@adminjs/themes`: light, dark, no-sidebar, plus custom themes       |

### Non-goals (first release)

- Paid AdminJS add-ons (for example the premium relations feature).
- Custom React pages beyond the dashboard.
- File uploads (`@adminjs/upload`); see [Phase 10](#phase-10--later).

---

## 2. Key design decisions

### 2.1 AdminJS talks to the models directly

AdminJS uses its Mongoose / Sequelize adapters to read and write **the models**. It does **not**
go through the module controllers or the Zod validation, which has two consequences:

- Forms, filters and lists come from the model, so there is no field metadata to generate. Lists
  get sorting, filtering and search for free, without the controller changes the hand-written plan
  needs (its Phase 3).
- The Zod rules (non-empty strings, integers in SQL, enum values in SQL…) are **not** applied
  automatically. A generated `before` hook runs the module's Zod schema on every new/edit action
  ([Phase 3](#phase-3--zod-validation-and-error-mapping)), so the admin and the API accept the same data.

### 2.2 ESM in CommonJS projects

AdminJS v7 and its packages are **ESM only**, while generated JavaScript projects use `require`.

- AdminJS is loaded with `await import('adminjs')` inside an async `buildAdminRouter()`.
  `import()` works from CommonJS.
- TypeScript projects use `"module": "nodenext"`, which keeps `import()` as a real dynamic import in
  the CommonJS output (it does not turn it into `require`), so the same approach works. **(verify)**
- Because loading is async and `src/app` must stay synchronous (tests import it), `src/app` mounts an
  **empty placeholder router** at the admin path, and `src/index` fills it after the databases connect:

  ```js
  // src/app.js
  const adminRouter = express.Router();
  app.use('/admin', adminRouter);        // inserted right after `const app = express()`
  // ... helmet, cors, express.json, routes, 404, errorHandler
  module.exports = app;
  module.exports.adminRouter = adminRouter;

  // src/index.js, inside startServer(), after connectDB()
  await mountAdmin(app.adminRouter);     // adminRouter.use(await buildAdminRouter())
  ```

  This keeps the route order correct (before the 404 handler), and tests that import `app` never load AdminJS.

### 2.3 Mount AdminJS before helmet and the body parsers

- The AdminJS Express router parses its own form bodies (`express-formidable`). It must be mounted
  **before** `express.json()` / `express.urlencoded()`, or requests to it hang or lose their body. **(verify)**
- The AdminJS frontend uses inline scripts and styles, which the default `helmet()` CSP blocks.
- So the placeholder router goes **right after `const app = express()`**, before `helmet()`. Inside the
  admin router a separate `helmet()` with a relaxed CSP is applied to `/admin` only. The exact
  directives AdminJS needs are found in the spike. **(verify)**

### 2.4 Login reuses `add-auth`, with its own session

- AdminJS logs in with a **session cookie** (`buildAuthenticatedRouter` + `express-session`), not the
  JWTs used by the API.
- The `authenticate(email, password)` function uses the auth module's `findUserByEmail` and
  `verifyPassword`, and only accepts users whose role is the admin role. So there is a single user
  table and the same `npm run auth:set-role` command.
- Sessions are stored in the database, never in the default memory store (which loses sessions on
  restart and leaks memory):
  - MongoDB → `connect-mongo`
  - PostgreSQL / MySQL → `connect-session-sequelize` (+ a `sessions` table migration)
- New env: `ADMIN_COOKIE_SECRET` (random, at least 32 characters, generated like `JWT_SECRET`).

### 2.5 One admin file per module

`add` writes `src/modules/products/products.admin.{js,ts}`, the AdminJS **resource options** for that
module, and registers it in `src/admin/resources` below markers. The file is plain code that users
can edit (columns, filters, navigation, actions).

---

## 3. What a generated project looks like after `add-admin`

```
my-project/
├── src/
│   ├── admin/
│   │   ├── admin.config.{js,ts}       # Path, role, title, theme, language
│   │   ├── index.{js,ts}              # buildAdminRouter() / mountAdmin(): loads AdminJS with import()
│   │   ├── resources.{js,ts}          # Resource list; CLI inserts below markers
│   │   ├── authenticate.{js,ts}       # email + password -> admin user or null
│   │   ├── session.{js,ts}            # express-session options + store (Mongo or Sequelize)
│   │   ├── zodHooks.{js,ts}           # before-hooks: AdminJS payload -> Zod -> ValidationError
│   │   ├── errors.{js,ts}             # Duplicate key / unique errors -> field error
│   │   ├── users.resource.{js,ts}     # Users: hidden hash, role select, password on create
│   │   ├── logs.{js,ts}               # @adminjs/logger setup + Log model
│   │   ├── locale.{js,ts}             # English labels (+ Bangla later)
│   │   ├── componentLoader.{js,ts}    # Registers the custom React components
│   │   ├── components/
│   │   │   └── Dashboard.jsx          # Counts per module + recent actions (JSX in TS projects too)
│   │   └── themes/                    # Optional custom theme(s)
│   ├── migrations/<connection>/…-create-sessions-and-admin-logs.{js,ts}   # SQL projects
│   └── modules/products/products.admin.{js,ts}
├── tests/admin.test.{js,ts}
└── .expressmodrc.json                 # gains "admin": { "path": "/admin", "engine": "adminjs" }
```

Dependencies added (versions pinned to a tested major in `lib/`):

| Package                       | Why                                         |
| ----------------------------- | ------------------------------------------- |
| `adminjs`                     | Core                                        |
| `@adminjs/express`            | Express router + login                      |
| `@adminjs/mongoose`           | Adapter (MongoDB projects)                  |
| `@adminjs/sequelize`          | Adapter (SQL projects)                      |
| `@adminjs/themes`             | Light / dark / no-sidebar themes            |
| `@adminjs/logger`             | Recent actions                              |
| `@adminjs/passwords`          | Password field on the Users resource (bcrypt hash function passed in) **(verify)** |
| `express-session`             | Login session                               |
| `express-formidable`          | Peer dependency of `@adminjs/express`        |
| `connect-mongo` / `connect-session-sequelize` | Session store                |
| `tslib`, `react` types        | Only if the spike shows TS needs them **(verify)** |

Only the adapter and session store for the databases the project uses are added.

---

## 4. Contracts

### 4.1 `products.admin.js` (generated by `add`, editable)

```js
const ProductModel = require('./products.model');
const { createProductSchema, updateProductSchema } = require('./products.validation');

/** AdminJS options for the products module. Called with the loaded AdminJS helpers. */
module.exports = ({ zodHooks }) => ({
  resource: ProductModel,
  options: {
    navigation: { name: 'Default', icon: 'Database' },   // Sidebar group (the connection name)
    listProperties: ['name', 'price', 'status', 'createdAt'],
    filterProperties: ['name', 'price', 'status', 'releasedAt', 'createdAt'],
    editProperties: ['name', 'price', 'stock', 'status', 'releasedAt'],
    showProperties: ['_id', 'name', 'price', 'stock', 'status', 'releasedAt', 'createdAt', 'updatedAt'],
    sort: { sortBy: 'createdAt', direction: 'desc' },
    properties: {
      // SQL enums are STRING columns with an isIn validator, which AdminJS can't detect,
      // so the values are listed here (harmless for MongoDB)
      status: {
        availableValues: [
          { value: 'draft', label: 'Draft' },
          { value: 'published', label: 'Published' },
        ],
      },
      description: { type: 'textarea' },   // text fields
    },
    actions: {
      new: { before: [zodHooks(createProductSchema, FIELDS)] },
      edit: { before: [zodHooks(updateProductSchema, FIELDS)] },
      // delete / bulkDelete: built in; set isAccessible: false to turn one off
    },
  },
});

// Field types, used to turn AdminJS's string payload into typed values before Zod runs
const FIELDS = { name: 'string', price: 'number', stock: 'integer', status: 'enum', releasedAt: 'date' };
```

The exact option names (`listProperties`, `availableValues`, `navigation`…) are AdminJS v7 resource
options. **(verify)**

### 4.2 Field type → AdminJS property

| Field type | Mongoose detection | Sequelize detection | Generated override                     |
| ---------- | ------------------ | ------------------- | -------------------------------------- |
| `string`   | string             | string              | none                                   |
| `text`     | string             | textarea? **(verify)** | `type: 'textarea'`                  |
| `number`   | number             | float               | none                                   |
| `integer`  | number             | number              | none (Zod hook rejects decimals)       |
| `boolean`  | boolean            | boolean             | none                                   |
| `date`     | datetime           | datetime            | `type: 'date'` (date only, like the API) |
| `enum`     | select (from `enum`) | **plain string**  | `availableValues` (needed for SQL)     |

### 4.3 Zod hook (`zodHooks`)

AdminJS sends form values as a flat object of strings. The hook:

1. Takes `request.payload` (only on `POST`; `GET` renders the form).
2. Converts each known field by type: `''` → `null` for optional fields (removed for fields with a default),
   numbers with `Number()`, booleans from `'true'`/`'false'`, dates kept as strings.
3. Runs the module's Zod schema (`safeParse`).
4. On failure, throws AdminJS's `ValidationError` with `{ [field]: { message } }`, so the form shows
   each error under its input. **(verify the import and shape)**
5. On success, puts the parsed values back into `request.payload`. Unknown keys are dropped, like
   `validate()` does in the API.

### 4.4 Errors (`errors.js`)

- Unique violations (MongoDB `11000`, `SequelizeUniqueConstraintError`) are turned into a field error
  ("A product with this name already exists") instead of a generic failure, by wrapping the
  `new` / `edit` handlers. **(verify where AdminJS lets us catch this)**
- Mongoose `CastError` on a bad id → "not found".

### 4.5 Users resource

- Columns: email, name, role, createdAt. `passwordHash` is never visible.
- Role is a select with the roles from the User model.
- **New user**: a virtual `password` field, hashed with the project's own `hashPassword` (bcrypt, 12
  rounds) through `@adminjs/passwords` with a custom `hash` function, or a simple `before` hook if
  that package doesn't fit. **(verify)**
- Edit: changing the password is optional (empty = keep).
- An admin can't remove their own admin role or delete themselves (a `before` hook compares
  `currentAdmin.id`).
- `RefreshToken` is not registered (internal).

### 4.6 Recent actions

- `@adminjs/logger`: a `Log` model (Mongoose or Sequelize, on the auth connection) plus `loggerFeature()`
  added to every resource, recording who did what to which record. **(verify setup and the fields it stores)**
- Configure it to store the **names** of changed fields, not their values (no secrets in logs).
- The Logs resource itself is read-only in the sidebar.

---

## 5. Phases

Sizes: **S** ≈ under half a day, **M** ≈ 1–2 days, **L** ≈ 3+ days.

### Phase 0: Spike: go / no-go (M)

Build one throwaway project by hand: `create --js --db mongodb`, `add-auth`, `add products …`, then
wire AdminJS manually. Repeat with `--ts --db postgres`.

Must confirm (all items marked **(verify)** in this file):

- [ ] AdminJS v7 + `@adminjs/express` work on **Express 5**.
- [ ] `@adminjs/mongoose` works with **Mongoose 9**, and `@adminjs/sequelize` with Sequelize 6.
- [ ] `import()` loading works in JS (CommonJS) and in TS (`nodenext`, run with `tsx` and with `tsc` output).
- [ ] TypeScript 7 + `skipLibCheck` compile cleanly with AdminJS's types.
- [ ] Mounting before the body parsers works; list the CSP directives the admin needs.
- [ ] Multiple database connections: models on different connections show up correctly.
- [ ] Component bundling: what happens on first start (time, `.adminjs/` folder) and how to
      pre-bundle for production.
- [ ] Logger and passwords packages: setup and options.
- [ ] Install size and cold start time (write the numbers down).

**Go** if Express 5, Mongoose 9 and the ESM loading all work. **No-go** → use the hand-written plan,
or wait for AdminJS support. Record the results in this file.

### Phase 1: Prerequisites (S)

- [ ] Finish and commit `add-auth` (still uncommitted). The admin uses its `User` model, repository,
      `verifyPassword`, `hashPassword` and `auth:set-role`.
- [ ] Decide the open questions in [section 8](#8-open-questions).

### Phase 2: Admin core in the generated project (L)

- [ ] `admin.config`:
  ```js
  module.exports = {
    path: '/admin',
    role: 'admin',
    title: process.env.ADMIN_TITLE || 'Administration',
    logo: false,                    // or a URL / path
    defaultTheme: 'light',          // light | dark | noSidebar | a custom theme id
    themes: ['light', 'dark', 'noSidebar'],
    language: 'en',
  };
  ```
- [ ] `index` → `buildAdminRouter()`:
  1. `const { default: AdminJS } = await import('adminjs')`, the Express plugin, the adapter(s) and themes.
  2. `AdminJS.registerAdapter(...)` for each database kind in use.
  3. `new AdminJS({ rootPath, resources, branding, locale, defaultTheme, availableThemes, dashboard, componentLoader })`.
  4. `buildAuthenticatedRouter(admin, { authenticate, cookieName, cookiePassword }, null, sessionOptions)`.
  5. Prepend the `/admin`-only helmet with the relaxed CSP.
  6. In development `admin.watch()`; in production use the pre-built bundle (see Phase 7).
- [ ] `mountAdmin(router)` used by `src/index` after `connectDB()`. If loading fails, log a clear message
      and keep the API running (the admin returns `503`), instead of crashing the server.
- [ ] `authenticate`: lowercase the email, `findUserByEmail`, `verifyPassword` (the timing-safe dummy hash
      check is already in it), role must equal `config.role`, returns `{ id, email, role }`.
- [ ] Login rate limit: reuse the auth `attemptLimiter` settings on `POST <path>/login`.
- [ ] `session`: `express-session` with the store, `secret: ADMIN_COOKIE_SECRET`, `httpOnly`,
      `sameSite: 'lax'`, `secure` in production, a reasonable `maxAge` (e.g. 8 h), `resave: false`,
      `saveUninitialized: false`. Fail at startup if the secret is missing or short.
- [ ] `resources`: `// ADMIN_IMPORTS` / `// ADMIN_RESOURCES` markers; the Users and Logs resources are always included.

Done when: logging in with an admin works, a `user` role is refused, and every module is listed and editable.

### Phase 3: Zod validation and error mapping (M)

- [ ] `zodHooks` (section 4.3) and `errors` (section 4.4).
- [ ] Every generated `*.admin` file uses them for `new` and `edit`.
- [ ] Check against the API: the same invalid input gets rejected in both places (empty required
      string, `1.5` for an integer, an unknown enum value in SQL, a bad date).

### Phase 4: Per-module admin files (M)

CLI:

- [ ] `lib/templates/adminjsTemplates.js` → `generateModuleAdminContent({ name, language, dbType, fields })`
      (section 4.1): list columns = first 4 fields + `createdAt`; filters = all fields; the `FIELDS` type
      map; `availableValues` for enums; `textarea` for text; `type: 'date'` for dates.
- [ ] `addModule.js`: when `project.admin` is set, write the admin file and register it (check the markers
      first with `assertMarkers`). `--no-admin` skips it.
- [ ] Navigation group = the module's connection name (like Django's app sections).
- [ ] Existing modules at `add-admin` time: field definitions aren't saved anywhere, so their admin file
      registers the model with **no overrides** (AdminJS reads the model) and **no Zod hook**
      (it can't build the type map). Generate it with a comment explaining what to add, and print a warning.
      Optional improvement: save the fields in `.expressmodrc.json` from now on so later commands know them.

### Phase 5: `add-admin` command (M)

`express-mod-cli add-admin [--path /admin] [--role admin] [--skip-install]`

- [ ] `lib/commands/addAdmin.js`, following `addAuth.js`.
- [ ] Check everything first (nothing written unless all checks pass):
  - inside a project, not legacy; `project.auth` exists (otherwise "run add-auth first", or offer to run it
    when interactive);
  - admin not already added; `--path` valid and not used by a module;
  - `src/app` contains `const app = express()` and the route markers; `src/index` contains `connectDB()`
    (to know where to add `mountAdmin`);
  - none of the files to create exist.
- [ ] Write `src/admin/**` (JS or TS; Mongo and/or SQL parts depending on the databases in use).
- [ ] Edit `src/app`: placeholder router after `const app = express()`, and export it.
- [ ] Edit `src/index`: `await mountAdmin(app.adminRouter)` after `connectDB()`.
- [ ] One admin file per existing module (Phase 4) and the registrations.
- [ ] SQL: migration for `sessions` + `admin_logs` on the auth connection.
- [ ] `.env` / `.env.example`: `ADMIN_COOKIE_SECRET` (random in `.env`), `ADMIN_TITLE`.
- [ ] `package.json`: dependencies from section 3, `admin:bundle` script (Phase 7).
- [ ] `.gitignore`: `.adminjs/`.
- [ ] `.expressmodrc.json`: `"admin": { "path": "/admin", "engine": "adminjs" }`.
- [ ] `npm install` unless `--skip-install`.
- [ ] Print next steps: `npm run auth:set-role -- you@example.com admin`, run migrations for SQL, then open `/admin`.
- [ ] `commandRouter.js` (`add-admin`, `--path`, `--no-admin`), `messages.js` (help, errors, instructions).

### Phase 6: Users, logs and dashboard (M)

- [ ] `users.resource` (section 4.5).
- [ ] `logs` (section 4.6): Log model per driver, `loggerFeature` added to every resource in `resources`.
- [ ] `components/Dashboard.jsx`: a card per module with its record count (from the `dashboard.handler`)
      and the 10 latest log entries with links. Registered through `componentLoader`.
- [ ] TS projects keep the component as `.jsx` so the AdminJS bundler doesn't need TS settings. **(verify)**

### Phase 7: Production bundle (S–M)

AdminJS bundles its frontend and custom components on startup. In production this should happen at
build or deploy time instead. **(verify the exact mechanism)**

- [ ] `npm run admin:bundle` builds the bundle into `public/admin/` (or `.adminjs/`).
- [ ] Startup in production uses the pre-built files (e.g. `ADMIN_JS_SKIP_BUNDLE=true` + `assetsCDN`
      pointing at the served folder).
- [ ] TS: `npm run build` runs `tsc` then `admin:bundle`.
- [ ] README: deployment steps, with a Docker example.

### Phase 8: Themes, branding and language (S)

- [ ] `@adminjs/themes`: `defaultTheme` + `availableThemes` from the config, so a theme switcher appears in the top bar.
- [ ] Branding: `companyName` (title), `logo`, `favicon`, hide "made with love", theme colour overrides.
- [ ] **Custom theme**: a folder in `src/admin/themes/<id>/` with colour overrides (and an optional stylesheet),
      added to `availableThemes`. Document copy-and-edit steps. **(verify the custom theme format)**
- [ ] `locale`: English labels for resources and fields (from the module names), with a ready place for a Bangla translation.

### Phase 9: Tests, docs, release (M)

CLI tests (`test/cli.test.js`):

- [ ] `add-admin` errors: outside a project, legacy, no auth, already added, missing anchors, file exists, invalid `--path`.
- [ ] Output for **JS/TS × MongoDB/PostgreSQL/MySQL**: files, `src/app` / `src/index` edits, dependencies,
      migration (SQL), `.env`, `.gitignore`, `.expressmodrc.json`.
- [ ] `add` in an admin project writes the admin file with the right overrides; `--no-admin` skips it.
- [ ] Generated TS still passes `tsc --noEmit` (needs the packages installed, so this runs in a slower,
      optional test or in CI).

Generated project tests (`tests/admin.test`):

- [ ] `authenticate`: admin accepted; wrong password, unknown email and `user` role refused (fake repository, no DB).
- [ ] `zodHooks`: payload conversion and error mapping for every field type.
- [ ] Importing `app` doesn't load AdminJS (the API tests stay fast).
- [ ] With the admin mounted (bundling skipped): `GET /admin` → redirect to login; `GET /admin/login` → 200. **(verify that this works without a database)**

Manual smoke test on all 6 combinations: login, list, search, filter, sort, add (valid and invalid),
edit, delete, bulk delete, users, recent actions, theme switch, log out, restart (session kept), and a
production start with the pre-built bundle.

Docs and release:

- [ ] README "Admin panel" section: setup, `*.admin` options, Zod hook, themes, production bundle, security notes.
- [ ] Commands table, generated structure, `.expressmodrc.json`, changelog, version bump.

### Phase 10: Later

| Feature                     | Notes                                                       |
| --------------------------- | ----------------------------------------------------------- |
| File uploads                | `@adminjs/upload` with local or S3 storage, when an upload field type exists |
| Import / export             | `@adminjs/import-export` (CSV / JSON)                       |
| Custom actions              | e.g. "Publish" on records and in bulk                        |
| Per-module permissions      | `isAccessible: ({ currentAdmin }) => …` per action           |
| Relations                   | When `add` supports references; the free adapters show ids, richer UI may need a paid add-on |
| Bangla translation          | Fill in `locale`                                              |
| More dashboard widgets      | Charts with a React chart library in the bundle              |

---

## 6. Security checklist

- [ ] Only users with the admin role can log in; checked on every request by the session, not only at login.
- [ ] `ADMIN_COOKIE_SECRET` required, random, at least 32 characters; startup fails without it.
- [ ] Session cookie: `httpOnly`, `sameSite: 'lax'`, `secure` in production; sessions kept in the database.
- [ ] Login attempts rate limited.
- [ ] CSP relaxed **only** under the admin path; the API keeps the default `helmet()`.
- [ ] `passwordHash`, refresh tokens and sessions are never shown.
- [ ] Writes go through the Zod hook, so admin data follows the same rules as the API.
- [ ] Logs store field names, not values.
- [ ] Admins can't demote or delete themselves.
- [ ] CSRF: AdminJS forms post with the session cookie, so `sameSite: 'lax'` is the protection.
      Check whether AdminJS has its own CSRF protection. **(verify)**
- [ ] Keep AdminJS packages updated; watch their security advisories.
- [ ] README: HTTPS in production, and a non-obvious `--path`.

---

## 7. Files to change in this repo

| File                                        | Change                                                    |
| ------------------------------------------- | --------------------------------------------------------- |
| `lib/commands/addAdmin.js`                  | **New**: the command                                      |
| `lib/templates/adminjsTemplates.js`         | **New**: config, index, resources, module admin file, users, logs, session, migration, tests |
| `lib/templates/static/adminjs/**`           | **New**: fixed files (`authenticate`, `zodHooks`, `errors`, `Dashboard.jsx`, …) in JS/TS |
| `lib/commands/addModule.js`                 | Write `<module>.admin` + register it; `--no-admin`         |
| `lib/commands/commandRouter.js`             | `add-admin`; `--path`, `--no-admin`                        |
| `lib/utils/projectConfig.js`                | `admin` in load/save; optionally save module fields       |
| `lib/utils/projectSupport.js`               | AdminJS dependency lists (pinned majors)                  |
| `lib/utils/fileUtils.js`                    | An insert helper for `src/index` / `src/app` edits, if `insertAfterLine` isn't enough |
| `lib/utils/messages.js`                     | Help, errors, next steps                                  |
| `test/cli.test.js`                          | Tests from Phase 9                                        |
| `README.md`                                 | Admin panel section, commands, changelog                  |

---

## 8. Open questions

1. **Spike result**: go or no-go (Phase 0). Everything else depends on it.
2. **Without auth**: fail with "run add-auth first", or run `add-auth` automatically?
3. **Existing modules**: accept model-only admin files without the Zod hook, or start saving module fields
   in `.expressmodrc.json` so `add-admin` can generate full files later?
4. **Production bundle**: build on `npm run build` / deploy, or bundle on first start and accept the slow start?
5. **Version policy**: pin AdminJS to one major and test each upgrade before bumping the CLI?

---

## 9. AdminJS vs the hand-written admin

| Topic                    | AdminJS (this plan)                              | Hand-written ([admin-panel-plan.md](admin-panel-plan.md)) |
| ------------------------ | ------------------------------------------------ | --------------------------------------- |
| Time to first version    | Shorter (UI is ready-made)                        | Longer (UI written from scratch)        |
| New dependencies         | ~10 packages, React bundle, tens of MB **(measure in spike)** | None                    |
| Fits CommonJS projects   | Needs `import()` + placeholder router             | Native                                  |
| Helmet / body parsers    | Must be bypassed for `/admin`                     | Unchanged                               |
| Login                    | Separate session + session store                  | Reuses the JWT login                    |
| Validation               | Bypasses Zod unless the hook is added             | Uses the module's Zod schemas directly  |
| Business logic           | Bypasses controllers (talks to models)            | Uses the controllers                    |
| Filters, sort, search    | Built in                                          | Needs controller changes (filters)      |
| Themes                   | Built-in switcher, dark mode                      | CSS variables, written by us            |
| Customizing              | React components + AdminJS options                | Plain JS / CSS                          |
| Production               | Extra bundle step                                 | Static files, nothing extra             |
| Upgrade risk             | AdminJS major versions, adapter support for new Mongoose/Express | Only our own code |
| Extra features later     | Upload, import/export, logger available as packages | Must be written                       |

---

## 10. Suggested order and milestones

| Milestone      | Phases     | Result                                                         |
| -------------- | ---------- | -------------------------------------------------------------- |
| M0: Decision   | 0          | Spike done, every **(verify)** answered, go / no-go             |
| M1: MVP        | 1, 2, 4, 5 | `add-admin` gives a working AdminJS panel with login and every module |
| M2: Safe data  | 3          | Admin edits follow the same Zod rules as the API                |
| M3: Django feel | 6, 8      | Users, recent actions, dashboard, themes                        |
| M4: Release    | 7, 9       | Production bundle, tests on 6 combinations, README, version bump |
| After          | 10         | By user demand                                                  |
