import type { ActionContext, ResourceWithOptions } from 'adminjs' with { 'resolution-mode': 'import' };
import config from './admin.config';

/**
 * Who may do what in the panel:
 * - admin: everything
 * - staff: view, add and edit records of the modules, and export them;
 *   not delete, import, or open the Users and Admin log pages
 */
export const isAdmin = ({ currentAdmin }: ActionContext): boolean => currentAdmin?.role === config.role;

const MODULE_ADMIN_ACTIONS = ['delete', 'bulkDelete', 'import'];
const ALL_ACTIONS = ['list', 'search', 'show', 'new', 'edit', 'delete', 'bulkDelete', 'export', 'import'];

type Rule = (context: ActionContext) => boolean;
type ActionOptions = Record<string, unknown> & { isAccessible?: boolean | Rule };

/** Both the role rule and the action's own isAccessible (a boolean or a function) must allow it */
const both = (rule: Rule, own: ActionOptions['isAccessible']): Rule => (context) =>
  rule(context) && (own === undefined || (typeof own === 'function' ? own(context) : own));

/** adminOnly: staff can't open the page at all */
export function withPermissions(resource: ResourceWithOptions, { adminOnly = false } = {}): ResourceWithOptions {
  const actions: Record<string, ActionOptions> = { ...(resource.options?.actions as Record<string, ActionOptions>) };

  for (const name of adminOnly ? ALL_ACTIONS : MODULE_ADMIN_ACTIONS) {
    // Only built-in actions and the ones the resource defines
    if (!['export', 'import'].includes(name) || actions[name]) {
      actions[name] = { ...actions[name], isAccessible: both(isAdmin, actions[name]?.isAccessible) };
    }
  }

  return { ...resource, options: { ...resource.options, actions } } as ResourceWithOptions;
}
