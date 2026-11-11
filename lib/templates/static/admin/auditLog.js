const { AdminLogModel, addLog } = require('./adminLog');

// Not worth a line in the log
const IGNORED_FIELDS = ['createdAt', 'updatedAt', '__v'];

/** Names of the fields whose value differs; a new password shows as "password" */
function changedFields(before = {}, after = {}) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys]
    .filter((key) => !IGNORED_FIELDS.includes(key) && String(before[key] ?? '') !== String(after[key] ?? ''))
    .map((key) => (key === 'passwordHash' ? 'password' : key));
}

/** Save log entries; a failure is reported but never breaks what the admin did */
async function save(entries) {
  try {
    await Promise.all(entries.map(addLog));
  } catch (error) {
    console.error('Could not write the admin log:', error.message);
  }
}

const entryFor = (context, action, record, changes) => ({
  action,
  resource: context.resource.id(),
  recordId: record ? String(record.id) : undefined,
  recordTitle: record?.title ? String(record.title).slice(0, 200) : undefined,
  changes: changes?.length ? changes.join(', ') : undefined,
  userId: String(context.currentAdmin.id),
  userEmail: context.currentAdmin.email,
});

/** Remember the record as it was, to see what an edit changed */
async function rememberRecord(request, context) {
  if (request.method === 'post' && context.record) {
    context.recordBefore = { ...context.record.params };
  }
  return request;
}

/** After a successful add / change / delete, write it to the log */
const logAction = (action) => async (response, request, context) => {
  if (request.method !== 'post' || response.notice?.type !== 'success' || !context.currentAdmin) {
    return response;
  }

  if (action === 'add') {
    await save([entryFor(context, 'add', response.record)]);
  } else if (action === 'change') {
    const changes = changedFields(context.recordBefore, context.record?.params);
    await save([entryFor(context, 'change', { id: context.record.id(), title: context.record.title() }, changes)]);
  } else {
    const records = context.records || (context.record ? [context.record] : []);
    await save(records.map((record) => entryFor(context, 'delete', { id: record.id(), title: record.title() })));
  }
  return response;
};

const append = (hooks, hook) => [...(hooks ? [].concat(hooks) : []), hook];

/** Log every add, change and delete of a resource */
function withAuditLog(resource) {
  const actions = { ...resource.options?.actions };
  const add = (name, key, hook) => {
    actions[name] = { ...actions[name], [key]: append(actions[name]?.[key], hook) };
  };

  add('new', 'after', logAction('add'));
  add('edit', 'before', rememberRecord);
  add('edit', 'after', logAction('change'));
  add('delete', 'after', logAction('delete'));
  add('bulkDelete', 'after', logAction('delete'));

  return { ...resource, options: { ...resource.options, actions } };
}

/** The "Admin log" page: read-only */
function adminLogResource() {
  const off = { isAccessible: false, isVisible: false };

  return {
    resource: AdminLogModel,
    options: {
      navigation: { name: 'Administration', icon: 'Activity' },
      listProperties: ['createdAt', 'userEmail', 'action', 'resource', 'recordTitle', 'changes'],
      filterProperties: ['createdAt', 'userEmail', 'action', 'resource', 'recordId'],
      showProperties: ['createdAt', 'userEmail', 'action', 'resource', 'recordId', 'recordTitle', 'changes'],
      sort: { sortBy: 'createdAt', direction: 'desc' },
      actions: { new: off, edit: off, delete: off, bulkDelete: off },
    },
  };
}

module.exports = { withAuditLog, adminLogResource, changedFields, save, entryFor };
