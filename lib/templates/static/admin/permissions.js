const config = require('./admin.config');

/**
 * Who may do what in the panel:
 * - admin: everything
 * - staff: view, add and edit records of the modules, and export them;
 *   not delete, import, or open the Users and Admin log pages
 */
const isAdmin = ({ currentAdmin }) => currentAdmin?.role === config.role;

const MODULE_ADMIN_ACTIONS = ['delete', 'bulkDelete', 'import'];
const ALL_ACTIONS = ['list', 'search', 'show', 'new', 'edit', 'delete', 'bulkDelete', 'export', 'import'];

/** Both the role rule and the action's own isAccessible (a boolean or a function) must allow it */
const both = (rule, own) => (context) =>
  rule(context) && (own === undefined || (typeof own === 'function' ? own(context) : own));

/**
 * @param {object} resource - AdminJS resource options
 * @param {{ adminOnly?: boolean }} [options] - adminOnly: staff can't open the page at all
 */
function withPermissions(resource, { adminOnly = false } = {}) {
  const actions = { ...resource.options?.actions };

  for (const name of adminOnly ? ALL_ACTIONS : MODULE_ADMIN_ACTIONS) {
    // Only built-in actions and the ones the resource defines
    if (!['export', 'import'].includes(name) || actions[name]) {
      actions[name] = { ...actions[name], isAccessible: both(isAdmin, actions[name]?.isAccessible) };
    }
  }

  return { ...resource, options: { ...resource.options, actions } };
}

module.exports = { isAdmin, withPermissions };
