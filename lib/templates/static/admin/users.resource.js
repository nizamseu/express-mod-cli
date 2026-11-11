const UserModel = require('../modules/auth/user.model');
const { revokeAllForUser } = require('../modules/auth/auth.repository');
const { registerSchema } = require('../modules/auth/auth.validation');
const { hashPassword } = require('../utils/security');
const config = require('./admin.config');

/** Is this record the admin who is logged in? */
const isSelf = (record, currentAdmin) =>
  Boolean(record && currentAdmin && String(record.id()) === String(currentAdmin.id));

/** Password hashes never leave the server, not even in the panel's API responses */
function hideSecrets(response) {
  for (const record of [response.record, ...(response.records || [])]) {
    if (record?.params) delete record.params.passwordHash;
  }
  return response;
}

/**
 * The Users page: create users with a password, change roles, reset passwords.
 * @param {{ ValidationError: Function }} deps - AdminJS's ValidationError class
 */
function usersResource({ ValidationError }) {
  /** Validate email / name / password like registration does, then hash the password */
  async function preparePayload(request, context) {
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
      const errors = {};
      for (const issue of result.error.issues) {
        errors[issue.path[0]] ??= { message: issue.message };
      }
      throw new ValidationError(errors);
    }

    if (isSelf(context.record, context.currentAdmin) && request.payload.role !== config.role) {
      throw new ValidationError({ role: { message: 'You cannot remove your own admin role' } });
    }

    const payload = { ...request.payload, email: result.data.email, name: result.data.name ?? null };
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

  async function logOutEverywhere(response, request, context) {
    if (context.passwordChanged && context.record) {
      await revokeAllForUser(String(context.record.id()));
    }
    return response;
  }

  // An admin can't delete their own account (also hides the button)
  const notSelf = ({ currentAdmin, record, records }) =>
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

module.exports = usersResource;
