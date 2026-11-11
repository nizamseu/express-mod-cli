import type {
  ActionContext,
  ActionRequest,
  FeatureType,
  ValidationError as AdminValidationError,
} from 'adminjs' with { 'resolution-mode': 'import' };
import type { ZodType } from 'zod';

/**
 * Runs a module's Zod schema on the admin panel's forms, so records saved in the
 * panel follow the same rules as the API (required fields, whole numbers, enum
 * values, dates...). Used as a "before" hook of the new and edit actions:
 *
 *   actions: { new: { before: [zodHooks(createProductSchema)] } }
 */

export type ValidationErrorClass = typeof AdminValidationError;
export type BeforeHook = (request: ActionRequest, context: ActionContext) => Promise<ActionRequest>;
export type ZodHooks = (schema: ZodType) => BeforeHook;

/** What src/admin/resources passes to every admin file */
export interface AdminHelpers {
  zodHooks: ZodHooks;
  ValidationError: ValidationErrorClass;
  /** An upload box for a file or image field: features: [uploadFile('photo', { images: true })] */
  uploadFile: (field: string, options?: { images?: boolean }) => FeatureType;
}

const NUMBER_TYPES = ['number', 'float', 'currency'];

/**
 * The form sends every value as text. Convert it to the type AdminJS knows from the model.
 * An empty input means "left out" when creating and "cleared" (null) when editing.
 */
export function toInputValue(value: unknown, type: string | undefined, creating: boolean): unknown {
  if (value === '' || value === null || value === undefined) {
    return creating ? undefined : null;
  }
  if (typeof value !== 'string') return value;

  if (type && NUMBER_TYPES.includes(type)) {
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

/** Makes before-hooks for Zod schemas; ValidationError is AdminJS's (adminjs is loaded with import()) */
export function createZodHooks(ValidationError: ValidationErrorClass): ZodHooks {
  return (schema) => async (request, context) => {
    // GET renders the form; only submissions are validated
    if (request.method !== 'post' || !request.payload) {
      return request;
    }

    const creating = context.action.name === 'new';
    const resource = context.resource.decorate();
    const input: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(request.payload)) {
      // Nested values ("tags.0") are left to the model
      if (key.includes('.')) continue;
      const type = resource.getPropertyByKey(key)?.type();
      input[key] = toInputValue(value, type, creating);
    }

    const result = schema.safeParse(input);

    if (!result.success) {
      const errors: Record<string, { message: string }> = {};
      let baseError: { message: string } | undefined;

      for (const issue of result.error.issues) {
        const key = issue.path[0];
        if (key === undefined) {
          baseError ??= { message: issue.message };
        } else if (!errors[String(key)]) {
          const missing = input[String(key)] === undefined || input[String(key)] === null;
          errors[String(key)] = { message: missing ? 'This field is required' : issue.message };
        }
      }

      throw new ValidationError(errors, baseError);
    }

    // Keep the values the schema doesn't know (id, timestamps), drop the left-out ones,
    // and use the parsed values (trimmed text, converted dates) for the rest
    const payload: Record<string, unknown> = { ...request.payload };
    for (const [key, value] of Object.entries(input)) {
      if (value === undefined) delete payload[key];
    }
    for (const [key, value] of Object.entries(result.data as Record<string, unknown>)) {
      if (value === undefined) continue;
      payload[key] = value instanceof Date ? value.toISOString() : value;
    }

    request.payload = payload;
    return request;
  };
}
