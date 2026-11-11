import type {
  ActionContext,
  ActionRequest,
  ActionResponse,
  BaseRecord,
  CurrentAdmin,
  ResourceWithOptions,
} from 'adminjs' with { 'resolution-mode': 'import' };
import UserModel from '../modules/auth/user.model';
import { revokeAllForUser } from '../modules/auth/auth.repository';
import { registerSchema } from '../modules/auth/auth.validation';
import { hashPassword } from '../utils/security';
import config from './admin.config';
import type { ValidationErrorClass } from './zodHooks';

/** Is this record the admin who is logged in? */
const isSelf = (record: BaseRecord | undefined, currentAdmin: CurrentAdmin | undefined): boolean =>
  Boolean(record && currentAdmin && String(record.id()) === String(currentAdmin.id));

/** Password hashes never leave the server, not even in the panel's API responses */
function hideSecrets(response: ActionResponse): ActionResponse {
  for (const record of [response.record, ...(response.records || [])]) {
    if (record?.params) delete record.params.passwordHash;
  }
  return response;
}

/** The Users page: create users with a password, change roles, reset passwords */
export default function usersResource({ ValidationError }: { ValidationError: ValidationErrorClass }): ResourceWithOptions {
  /** Validate email / name / password like registration does, then hash the password */
  async function preparePayload(request: ActionRequest, context: ActionContext): Promise<ActionRequest> {
    if (request.method !== 'post' || !request.payload) return request;

    const creating = context.action.name === 'new';
    const { email, name, password } = request.payload;
    const schema = creating ? registerSchema : registerSchema.partial();
    const result = schema.safeParse({
      email,
      name: name || undefined,
      password: password || undefined,
    });

    if (!result.success) {
      const errors: Record<string, { message: string }> = {};
      for (const issue of result.error.issues) {
        errors[String(issue.path[0])] ??= { message: issue.message };
      }
      throw new ValidationError(errors);
    }

    if (isSelf(context.record, context.currentAdmin) && request.payload.role !== config.role) {
      throw new ValidationError({ role: { message: 'You cannot remove your own admin role' } });
    }

    const payload: Record<string, unknown> = { ...request.payload, email: result.data.email, name: result.data.name ?? null };
    delete payload.password;
    delete payload.passwordHash;

    if (result.data.password) {
      payload.passwordHash = await hashPassword(result.data.password);
      // Remembered for the after-hook: a new password logs the user out everywhere
      context.passwordChanged = !creating;
    }

    request.payload = payload;
    return request;
  }

  async function logOutEverywhere(response: ActionResponse, _request: ActionRequest, context: ActionContext): Promise<ActionResponse> {
    if (context.passwordChanged && context.record) {
      await revokeAllForUser(String(context.record.id()));
    }
    return response;
  }

  // An admin can't delete their own account (also hides the button)
  const notSelf = ({ currentAdmin, record, records }: ActionContext): boolean =>
    !isSelf(record, currentAdmin) && !(records || []).some((item) => isSelf(item, currentAdmin));

  return {
    resource: UserModel,
    options: {
      navigation: { name: 'Authentication', icon: 'User' },
      listProperties: ['email', 'name', 'role', 'emailVerifiedAt', 'createdAt'],
      filterProperties: ['email', 'name', 'role', 'emailVerifiedAt', 'createdAt'],
      showProperties: ['email', 'name', 'role', 'emailVerifiedAt', 'createdAt', 'updatedAt'],
      editProperties: ['email', 'name', 'role', 'password'],
      sort: { sortBy: 'createdAt', direction: 'desc' },
      properties: {
        passwordHash: { isVisible: false },
        password: {
          type: 'password',
          description: 'Leave empty to keep the current password',
          isVisible: { list: false, filter: false, show: false, edit: true },
        },
        emailVerifiedAt: { isVisible: { list: true, filter: true, show: true, edit: false } },
      },
      actions: {
        list: { after: hideSecrets },
        search: { after: hideSecrets },
        show: { after: hideSecrets },
        new: { before: preparePayload, after: hideSecrets },
        edit: { before: preparePayload, after: [hideSecrets, logOutEverywhere] },
        delete: { isAccessible: notSelf, after: hideSecrets },
        bulkDelete: { isAccessible: notSelf, after: hideSecrets },
      },
    },
  };
}
