import type {
  ActionContext,
  ActionRequest,
  ActionResponse,
  After,
  Before,
  ResourceWithOptions,
} from 'adminjs' with { 'resolution-mode': 'import' };
import { AdminLogModel, addLog, type AdminLogEntry } from './adminLog';

// Not worth a line in the log
const IGNORED_FIELDS = ['createdAt', 'updatedAt', '__v'];

type Params = Record<string, unknown>;
type RecordInfo = { id: unknown; title?: unknown };

/** Names of the fields whose value differs; a new password shows as "password" */
export function changedFields(before: Params = {}, after: Params = {}): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys]
    .filter((key) => !IGNORED_FIELDS.includes(key) && String(before[key] ?? '') !== String(after[key] ?? ''))
    .map((key) => (key === 'passwordHash' ? 'password' : key));
}

/** Save log entries; a failure is reported but never breaks what the admin did */
export async function save(entries: AdminLogEntry[]): Promise<void> {
  try {
    await Promise.all(entries.map(addLog));
  } catch (error) {
    console.error('Could not write the admin log:', error instanceof Error ? error.message : error);
  }
}

export const entryFor = (
  context: ActionContext,
  action: AdminLogEntry['action'],
  record?: RecordInfo,
  changes?: string[]
): AdminLogEntry => ({
  action,
  resource: context.resource.id(),
  recordId: record ? String(record.id) : undefined,
  recordTitle: record?.title ? String(record.title).slice(0, 200) : undefined,
  changes: changes?.length ? changes.join(', ') : undefined,
  userId: String(context.currentAdmin?.id),
  userEmail: String(context.currentAdmin?.email),
});

/** Remember the record as it was, to see what an edit changed */
async function rememberRecord(request: ActionRequest, context: ActionContext): Promise<ActionRequest> {
  if (request.method === 'post' && context.record) {
    context.recordBefore = { ...context.record.params };
  }
  return request;
}

/** After a successful add / change / delete, write it to the log */
const logAction =
  (action: 'add' | 'change' | 'delete') =>
  async (response: ActionResponse, request: ActionRequest, context: ActionContext): Promise<ActionResponse> => {
    if (request.method !== 'post' || response.notice?.type !== 'success' || !context.currentAdmin) {
      return response;
    }

    if (action === 'add') {
      await save([entryFor(context, 'add', response.record)]);
    } else if (action === 'change' && context.record) {
      const changes = changedFields(context.recordBefore, context.record.params);
      await save([entryFor(context, 'change', { id: context.record.id(), title: context.record.title() }, changes)]);
    } else if (action === 'delete') {
      const records = context.records || (context.record ? [context.record] : []);
      await save(records.map((record) => entryFor(context, 'delete', { id: record.id(), title: record.title() })));
    }
    return response;
  };

type Hooks<T> = T | T[] | undefined;
const append = <T>(hooks: Hooks<T>, hook: T): T[] => [...(hooks ? ([] as T[]).concat(hooks) : []), hook];

type ActionOptions = { before?: Hooks<Before>; after?: Hooks<After<ActionResponse>> } & Record<string, unknown>;

/** Log every add, change and delete of a resource */
export function withAuditLog(resource: ResourceWithOptions): ResourceWithOptions {
  const actions: Record<string, ActionOptions> = { ...(resource.options?.actions as Record<string, ActionOptions>) };
  const before = (name: string, hook: Before) => {
    actions[name] = { ...actions[name], before: append(actions[name]?.before, hook) };
  };
  const after = (name: string, hook: After<ActionResponse>) => {
    actions[name] = { ...actions[name], after: append(actions[name]?.after, hook) };
  };

  after('new', logAction('add'));
  before('edit', rememberRecord);
  after('edit', logAction('change'));
  after('delete', logAction('delete'));
  after('bulkDelete', logAction('delete'));

  return { ...resource, options: { ...resource.options, actions } } as ResourceWithOptions;
}

/** The "Admin log" page: read-only */
export function adminLogResource(): ResourceWithOptions {
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
