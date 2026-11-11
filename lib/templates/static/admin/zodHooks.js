/**
 * Runs a module's Zod schema on the admin panel's forms, so records saved in the
 * panel follow the same rules as the API (required fields, whole numbers, enum
 * values, dates...). Used as a "before" hook of the new and edit actions:
 *
 *   actions: { new: { before: [zodHooks(createProductSchema)] } }
 */

const NUMBER_TYPES = ['number', 'float', 'currency'];

/**
 * The form sends every value as text. Convert it to the type AdminJS knows from the model.
 * An empty input means "left out" when creating and "cleared" (null) when editing.
 */
function toInputValue(value, type, creating) {
  if (value === '' || value === null || value === undefined) {
    return creating ? undefined : null;
  }
  if (typeof value !== 'string') return value;

  if (NUMBER_TYPES.includes(type)) {
    const number = Number(value);
    return value.trim() !== '' && !Number.isNaN(number) ? number : value;
  }
  // SQL ids are numbers; a MongoDB id stays text
  if (type === 'reference' && /^\d+$/.test(value)) {
    return Number(value);
  }
  if (type === 'boolean') {
    if (value === 'true') return true;
    if (value === 'false') return false;
  }
  // Dates stay strings: the module schemas parse date strings themselves
  return value;
}

/**
 * @param {Function} ValidationError - AdminJS's ValidationError class (adminjs is loaded with import())
 * @returns {(schema: import('zod').ZodType) => Function} - Makes a before-hook for a schema
 */
function createZodHooks(ValidationError) {
  return function zodHooks(schema) {
    return async function validateWithZod(request, context) {
      // GET renders the form; only submissions are validated
      if (request.method !== 'post' || !request.payload) {
        return request;
      }

      const creating = context.action.name === 'new';
      const resource = context.resource.decorate();
      const input = {};

      for (const [key, value] of Object.entries(request.payload)) {
        // Nested values ("tags.0") are left to the model
        if (key.includes('.')) continue;
        const type = resource.getPropertyByKey(key)?.type();
        input[key] = toInputValue(value, type, creating);
      }

      const result = schema.safeParse(input);

      if (!result.success) {
        const errors = {};
        let baseError;

        for (const issue of result.error.issues) {
          const key = issue.path[0];
          if (key === undefined) {
            baseError ??= { message: issue.message };
          } else if (!errors[key]) {
            const missing = input[key] === undefined || input[key] === null;
            errors[key] = { message: missing ? 'This field is required' : issue.message };
          }
        }

        throw new ValidationError(errors, baseError);
      }

      // Keep the values the schema doesn't know (id, timestamps), drop the left-out ones,
      // and use the parsed values (trimmed text, converted dates) for the rest
      const payload = { ...request.payload };
      for (const [key, value] of Object.entries(input)) {
        if (value === undefined) delete payload[key];
      }
      for (const [key, value] of Object.entries(result.data)) {
        if (value === undefined) continue;
        payload[key] = value instanceof Date ? value.toISOString() : value;
      }

      request.payload = payload;
      return request;
    };
  };
}

module.exports = { createZodHooks, toInputValue };
