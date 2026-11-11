const path = require('path');
const helmet = require('helmet');
const session = require('express-session');
const adminRouter = require('./router');
const config = require('./admin.config');
const databases = require('../config/databases');
const UserModel = require('../modules/auth/user.model');
const { authenticate, checkSession } = require('./authenticate');
const { sessionOptions } = require('./session');
const { createZodHooks } = require('./zodHooks');
const { getResources } = require('./resources');
const { ensureDefaultAdmin } = require('./defaultAdmin');
const { withPermissions } = require('./permissions');
const { withAuditLog, adminLogResource, save, entryFor } = require('./auditLog');
const { recentLogs } = require('./adminLog');
const { createImportExport } = require('./importExport');
const { createUploadFile } = require('./uploads');
const passwordReset = require('./passwordReset');
const themeSwitcher = require('./theme');
const translations = require('./translations');

// Custom React components of the panel. They are read from src/ in TypeScript projects too
// (dist/admin -> ../../src/admin), because tsc doesn't copy .jsx files.
const COMPONENTS_DIR = path.join(__dirname, '..', '..', 'src', 'admin', 'components');
const SESSION_COOKIE = 'admin_session';

/** The admin packages are ES modules, so they are loaded with import() */
async function importPackage(name) {
  try {
    return await import(name);
  } catch (error) {
    if (error.code === 'ERR_MODULE_NOT_FOUND') {
      throw new Error(`The package "${name}" is missing - run: npm install ${name}`);
    }
    throw error;
  }
}

/** Register the adapter of each kind of database the project uses */
async function registerAdapters(AdminJS) {
  const types = new Set(Object.values(databases).map((db) => db.type));

  if (types.has('mongodb')) {
    AdminJS.registerAdapter(await importPackage('@adminjs/mongoose'));
  }
  if (types.has('postgres') || types.has('mysql')) {
    AdminJS.registerAdapter(await importPackage('@adminjs/sequelize'));
  }
}

/**
 * file and image fields need @adminjs/upload ("express-mod-cli add" installs it for them).
 * Without such fields the package isn't needed.
 */
async function loadUploadFile({ componentLoader, ValidationError, flat }) {
  let upload;
  try {
    upload = await import('@adminjs/upload');
  } catch {
    return () => {
      throw new Error('file and image fields need the package "@adminjs/upload" - run: npm install @adminjs/upload');
    };
  }
  return createUploadFile({
    uploadFeature: upload.default,
    BaseProvider: upload.BaseProvider,
    componentLoader,
    ValidationError,
    flat,
  });
}

/**
 * Settings every resource gets unless its admin file says otherwise:
 * - SQL enums (string columns with an isIn validator) become a select box
 * - MongoDB's internal version key (__v) is hidden
 */
function withModelDefaults(resource) {
  const model = resource.resource;
  const properties = { ...resource.options?.properties };

  if (typeof model.getAttributes === 'function') {
    for (const [name, attribute] of Object.entries(model.getAttributes())) {
      const values = attribute.validate?.isIn?.[0];
      if (Array.isArray(values) && !properties[name]?.availableValues) {
        properties[name] = {
          ...properties[name],
          availableValues: values.map((value) => ({ value, label: String(value) })),
        };
      }
    }
  } else if (model.schema?.path('__v')) {
    properties.__v = { isVisible: false, ...properties.__v };
  }

  return { ...resource, options: { ...resource.options, properties } };
}

/**
 * A ref field must point to an existing record. Checked before saving, so the form
 * shows a clear message instead of a database error.
 */
function withReferenceChecks(resource, ValidationError) {
  const model = resource.resource;
  const refs = [];

  if (typeof model.getAttributes === 'function') {
    for (const [name, attribute] of Object.entries(model.getAttributes())) {
      const table = attribute.references?.model;
      if (!table) continue;
      const target = () => Object.values(model.sequelize.models).find((item) => item.getTableName() === table);
      refs.push([name, async (id) => !target() || Boolean(await target().findByPk(id))]);
    }
  } else if (model.schema) {
    model.schema.eachPath((name, schemaType) => {
      const ref = schemaType.options?.ref;
      if (ref) refs.push([name, async (id) => !model.db.models[ref] || Boolean(await model.db.models[ref].exists({ _id: id }))]);
    });
  }
  if (refs.length === 0) return resource;

  const checkReferences = async (request) => {
    if (request.method !== 'post' || !request.payload) return request;

    const errors = {};
    for (const [name, exists] of refs) {
      const value = request.payload[name];
      if (value === undefined || value === null || value === '') continue;
      const found = await exists(value).catch(() => false);
      if (!found) errors[name] = { message: 'There is no record with this id' };
    }
    if (Object.keys(errors).length > 0) throw new ValidationError(errors);
    return request;
  };

  const actions = { ...resource.options?.actions };
  for (const name of ['new', 'edit']) {
    // After the module's own hooks, which turn the form's text into ids
    actions[name] = { ...actions[name], before: [...[].concat(actions[name]?.before || []), checkReferences] };
  }
  return { ...resource, options: { ...resource.options, actions } };
}

/**
 * Fields of other models that point to a model (ref fields), with how to count and clear them.
 * Looked up when needed, so every model is loaded by then.
 */
function pointingFields(model) {
  const fields = [];

  if (typeof model.getAttributes === 'function') {
    const table = model.getTableName();
    for (const other of Object.values(model.sequelize.models)) {
      for (const [field, attribute] of Object.entries(other.getAttributes())) {
        if (attribute.references?.model !== table) continue;
        fields.push({
          label: String(other.getTableName()),
          field,
          required: attribute.allowNull === false,
          count: (id) => other.count({ where: { [field]: id } }),
          // SQL clears optional links itself (ON DELETE SET NULL)
          clear: null,
        });
      }
    }
  } else if (model.schema) {
    for (const other of Object.values(model.db.models)) {
      other.schema.eachPath((field, schemaType) => {
        if (schemaType.options?.ref !== model.modelName) return;
        fields.push({
          label: other.collection.collectionName,
          field,
          required: Boolean(schemaType.options.required),
          count: (id) => other.countDocuments({ [field]: id }),
          clear: (id) => other.updateMany({ [field]: id }, { $set: { [field]: null } }),
        });
      });
    }
  }
  return fields;
}

/**
 * A record that others need (a required ref field points to it) can't be deleted:
 * the panel says which records to delete or change first, instead of a database error.
 * Optional links to a deleted record are cleared.
 */
function withDeleteChecks(resource, ValidationError) {
  const model = resource.resource;
  const idsOf = (context) => (context.records || (context.record ? [context.record] : [])).map((record) => record.id());

  const checkPointers = async (request, context) => {
    if (request.method !== 'post') return request;

    const blocking = [];
    for (const pointer of pointingFields(model).filter((item) => item.required)) {
      let total = 0;
      for (const id of idsOf(context)) total += await pointer.count(id);
      if (total > 0) blocking.push(`${total} ${pointer.label} (${pointer.field})`);
    }
    if (blocking.length > 0) {
      throw new ValidationError({}, {
        message: `Can't delete: ${blocking.join(', ')} still point to it. Delete or change those first.`,
      });
    }
    return request;
  };

  const clearPointers = async (response, request, context) => {
    if (request.method !== 'post' || response.notice?.type !== 'success') return response;
    for (const pointer of pointingFields(model).filter((item) => !item.required && item.clear)) {
      for (const id of idsOf(context)) await pointer.clear(id);
    }
    return response;
  };

  const actions = { ...resource.options?.actions };
  for (const name of ['delete', 'bulkDelete']) {
    actions[name] = {
      ...actions[name],
      before: [checkPointers, ...[].concat(actions[name]?.before || [])],
      after: [...[].concat(actions[name]?.after || []), clearPointers],
    };
  }
  return { ...resource, options: { ...resource.options, actions } };
}

/** Build the AdminJS instance and its Express router */
async function buildAdmin(sessionConfig) {
  const { default: AdminJS, ComponentLoader, Filter, ValidationError, flat } = await importPackage('adminjs');
  const { default: AdminJSExpress } = await importPackage('@adminjs/express');
  const themes = await importPackage('@adminjs/themes');

  await registerAdapters(AdminJS);

  const componentLoader = new ComponentLoader();
  const component = (name) => path.join(COMPONENTS_DIR, name);
  const components = {
    Dashboard: componentLoader.add('Dashboard', component('Dashboard')),
    Export: componentLoader.add('Export', component('Export')),
    Import: componentLoader.add('Import', component('Import')),
  };
  // Our login page has a "Forgot your password?" link
  componentLoader.override('Login', component('Login'));
  // The user menu has a theme switcher
  componentLoader.override('LoggedIn', component('LoggedIn'));

  const helpers = {
    zodHooks: createZodHooks(ValidationError),
    ValidationError,
    uploadFile: await loadUploadFile({ componentLoader, ValidationError, flat }),
  };
  const withImportExport = createImportExport({ Filter, ValidationError, flat, components, save, entryFor });

  // Every page gets Export / Import, the admin log, and the admin / staff rules
  const resources = getResources(helpers)
    .map(withModelDefaults)
    .map((resource) => withReferenceChecks(resource, ValidationError))
    .map((resource) => withDeleteChecks(resource, ValidationError))
    .map((resource) =>
      withPermissions(withAuditLog(withImportExport(resource)), { adminOnly: resource.resource === UserModel })
    );

  // The admin log itself: read-only, exportable, for admins
  const logs = withImportExport(adminLogResource());
  logs.options.actions.import = { isAccessible: false, isVisible: false };
  resources.push(withPermissions(logs, { adminOnly: true }));

  // Shown in the user menu of the top bar (see components/LoggedIn.jsx)
  const availableThemes = [
    { ...themes.light, name: 'Light' },
    { ...themes.dark, name: 'Dark' },
    { ...themes.noSidebar, name: 'Light, no sidebar' },
  ];

  const admin = new AdminJS({
    rootPath: config.path,
    loginPath: `${config.path}/login`,
    logoutPath: `${config.path}/logout`,
    resources,
    componentLoader,
    branding: {
      companyName: config.title,
      logo: config.logo,
      favicon: config.favicon,
      withMadeWithLove: false,
    },
    version: { admin: false },
    defaultTheme: availableThemes.some((theme) => theme.id === config.theme) ? config.theme : themes.light.id,
    availableThemes,
    dashboard: {
      component: components.Dashboard,
      // Records per resource, and the logged-in user's latest actions ("My actions")
      handler: async (request, response, context) => {
        const counts = {};
        await Promise.all(
          admin.resources.map(async (resource) => {
            counts[resource.id()] = await resource.count(new Filter({}, resource));
          })
        );
        const recent = context.currentAdmin ? await recentLogs({ userId: String(context.currentAdmin.id), limit: 10 }) : [];
        return { title: config.title, counts, recent };
      },
    },
    locale: {
      language: config.language,
      availableLanguages: ['en', 'bn'],
      fallbackLng: 'en',
      translations: translations(config.title),
    },
  });

  const router = AdminJSExpress.buildAuthenticatedRouter(
    admin,
    {
      authenticate,
      cookieName: SESSION_COOKIE,
      cookiePassword: config.cookieSecret(),
      maxRetries: { count: config.loginAttempts, duration: 15 * 60 },
    },
    null,
    sessionConfig
  );

  return { admin, router };
}

/**
 * Start the admin panel. Called by src/index once the databases are connected.
 * If it can't start, the API keeps running and the panel answers 503.
 */
async function mountAdmin() {
  try {
    const sessionConfig = sessionOptions();
    const { admin, router } = await buildAdmin(sessionConfig);

    // The usual security headers; the panel's own scripts need the default CSP turned off
    adminRouter.use(helmet({ contentSecurityPolicy: false }));
    // The login session is read here first (AdminJS then reuses it), so every request
    // can check that the user is still an admin or staff with the same password
    adminRouter.use(session({ ...sessionConfig, name: SESSION_COOKIE }));
    adminRouter.use(checkSession);
    adminRouter.use(passwordReset);
    adminRouter.use(themeSwitcher);
    adminRouter.use(router);

    // In development the custom components are rebuilt when they change.
    // In production they are built once on startup (set NODE_ENV=production).
    if (process.env.NODE_ENV !== 'production') {
      await admin.watch();
    }
  } catch (error) {
    console.error('The admin panel could not start:', error);
    adminRouter.use((req, res) => {
      res.status(503).json({ success: false, message: 'The admin panel is not available - see the server log' });
    });
    return;
  }

  try {
    await ensureDefaultAdmin();
  } catch (error) {
    console.error('Could not create the default admin user:', error.message);
  }

  console.log(`Admin panel: ${config.path}`);
}

module.exports = { buildAdmin, mountAdmin, withModelDefaults };
