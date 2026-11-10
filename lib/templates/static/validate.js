/**
 * Validate req.body against a Zod schema before the controller runs.
 *
 * On success req.body is replaced by the parsed data, so fields the schema
 * does not list never reach the database. On failure the request ends with
 * a 400 that names every invalid field.
 *
 * @param {import('zod').ZodType} schema
 */
const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body ?? {});

  if (!result.success) {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message
      }))
    });
    return;
  }

  req.body = result.data;
  next();
};

module.exports = validate;
