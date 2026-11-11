/**
 * Turns parsed field definitions (see utils/fields.js) into code for
 * Mongoose schemas, Sequelize models / migrations, Zod schemas and TypeScript types.
 *
 * @typedef {import("../utils/fields").Field} Field
 */

const { moduleNames } = require("../utils/names");

/** A JavaScript literal for a value: 'text', 42, true */
const literal = (value) =>
  typeof value === "string"
    ? `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`
    : String(value);

const literalList = (values) => `[${values.map(literal).join(", ")}]`;

/**
 * Render `name: { key: value, ... }` blocks, one per field
 * @param {[string, [string, string][]][]} entries - [fieldName, [[key, code], ...]]
 * @param {string} indent - Indentation of the field name
 */
const renderBlocks = (entries, indent = "  ") =>
  entries
    .map(([name, props]) => {
      const lines = props.map(([key, code]) => `${indent}  ${key}: ${code}`);
      return `${indent}${name}: {\n${lines.join(",\n")}\n${indent}}`;
    })
    .join(",\n");

const MONGOOSE_TYPES = {
  string: "String",
  text: "String",
  number: "Number",
  integer: "Number",
  boolean: "Boolean",
  date: "Date",
  enum: "String",
  file: "String",
  image: "String",
};

const TEXT_TYPES = ["string", "text", "file", "image"];

/**
 * Field definitions of a Mongoose schema
 * @param {Field[]} fields
 * @param {{ ts?: boolean }} [options] - TypeScript models import Schema instead of mongoose
 */
const mongooseFields = (fields, { ts = false } = {}) =>
  renderBlocks(
    fields.map((field) => {
      const props =
        field.type === "ref"
          ? [
              ["type", ts ? "Schema.Types.ObjectId" : "mongoose.Schema.Types.ObjectId"],
              ["ref", literal(moduleNames(field.ref).singularPascal)],
            ]
          : [["type", MONGOOSE_TYPES[field.type]]];

      if (field.required) props.push(["required", "true"]);
      if (TEXT_TYPES.includes(field.type)) props.push(["trim", "true"]);
      if (field.type === "enum") props.push(["enum", literalList(field.values)]);
      if (field.type === "integer") {
        props.push([
          "validate",
          `{ validator: Number.isInteger, message: '{PATH} must be an integer' }`,
        ]);
      }
      if (field.unique) props.push(["unique", "true"]);
      if (field.hasDefault) props.push(["default", literal(field.default)]);

      return [field.name, props];
    })
  );

const SEQUELIZE_TYPES = {
  string: "DataTypes.STRING",
  text: "DataTypes.TEXT",
  number: "DataTypes.DOUBLE",
  integer: "DataTypes.INTEGER",
  boolean: "DataTypes.BOOLEAN",
  date: "DataTypes.DATE",
  // A plain string column: changing the allowed values later needs no schema change
  enum: "DataTypes.STRING",
  // The path of the uploaded file
  file: "DataTypes.STRING",
  image: "DataTypes.STRING",
  // The id of a record of another module
  ref: "DataTypes.INTEGER",
};

/**
 * Attribute definitions for a Sequelize model, or for the createTable call of a migration
 * @param {Field[]} fields
 * @param {object} [options]
 * @param {boolean} [options.migration] - Column definitions only (no validators)
 * @param {boolean} [options.withId] - Include the id primary key
 * @param {boolean} [options.withTimestamps] - Include createdAt / updatedAt
 * @param {string} [options.indent]
 */
const sequelizeAttributes = (fields, options = {}) => {
  const { migration = false, withId = false, withTimestamps = false, indent } = options;
  const entries = [];

  if (withId) {
    entries.push([
      "id",
      [
        ["type", "DataTypes.INTEGER"],
        ["autoIncrement", "true"],
        ["primaryKey", "true"],
      ],
    ]);
  }

  for (const field of fields) {
    const props = [["type", SEQUELIZE_TYPES[field.type]]];

    if (!field.optional) props.push(["allowNull", "false"]);
    if (field.unique) props.push(["unique", "true"]);
    if (field.hasDefault) props.push(["defaultValue", literal(field.default)]);
    if (field.type === "enum" && !migration) {
      props.push(["validate", `{ isIn: [${literalList(field.values)}] }`]);
    }
    if (field.type === "ref") {
      props.push(["references", `{ model: ${literal(moduleNames(field.ref).table)}, key: 'id' }`]);
      // A record that others point to can't be deleted; an optional link is cleared instead
      if (migration) props.push(["onDelete", field.optional ? "'SET NULL'" : "'RESTRICT'"]);
    }

    entries.push([field.name, props]);
  }

  if (withTimestamps) {
    for (const name of ["createdAt", "updatedAt"]) {
      entries.push([
        name,
        [
          ["type", "DataTypes.DATE"],
          ["allowNull", "false"],
        ],
      ]);
    }
  }

  return renderBlocks(entries, indent);
};

const TS_TYPES = {
  string: "string",
  text: "string",
  number: "number",
  integer: "number",
  boolean: "boolean",
  date: "Date",
  file: "string",
  image: "string",
  ref: "number",
};

/** The TypeScript type of a field's value */
const tsType = (field) =>
  field.type === "enum" ? field.values.map(literal).join(" | ") : TS_TYPES[field.type];

/**
 * `declare` lines of a Sequelize model class (TypeScript)
 * @param {Field[]} fields
 */
const sequelizeDeclarations = (fields) =>
  fields
    .map((field) => {
      const type = field.optional ? `${tsType(field)} | null` : tsType(field);
      // Fields that may be left out when creating a record
      return field.required
        ? `  declare ${field.name}: ${type};`
        : `  declare ${field.name}: CreationOptional<${type}>;`;
    })
    .join("\n");

const ZOD_TYPES = {
  string: "z.string().trim().min(1)",
  text: "z.string().trim().min(1)",
  number: "z.number()",
  integer: "z.number().int()",
  boolean: "z.boolean()",
  // A date string ("2026-01-31" or "2026-01-31T10:00:00Z"), converted to a Date
  date: "z.string().refine((value) => !Number.isNaN(Date.parse(value)), 'Expected a date such as 2026-01-31').transform((value) => new Date(value))",
  file: "z.string().trim().min(1)",
  image: "z.string().trim().min(1)",
};

/** Zod schema of a ref field: a MongoDB ObjectId, or a SQL auto-increment id */
const zodRef = (field, driver) =>
  driver === "mongodb"
    ? `z.string().regex(/^[0-9a-f]{24}$/i, 'Expected the id of a ${moduleNames(field.ref).singularLabel.toLowerCase()}')`
    : "z.number().int().positive()";

/**
 * Properties of the Zod schema that validates the request body
 * @param {Field[]} fields
 * @param {{ driver?: "mongodb"|"sql" }} [options] - Decides what an id looks like (ref fields)
 */
const zodFields = (fields, { driver = "mongodb" } = {}) =>
  fields
    .map((field) => {
      let schema =
        field.type === "enum"
          ? `z.enum(${literalList(field.values)})`
          : field.type === "ref"
            ? zodRef(field, driver)
            : ZOD_TYPES[field.type];

      if (field.optional) {
        schema += ".nullish()"; // may be left out or null
      } else if (field.hasDefault) {
        schema += ".optional()"; // the database fills in the default
      }

      return `  ${field.name}: ${schema}`;
    })
    .join(",\n");

/** A value of the wrong type for a field - used by the generated validation test */
const invalidValue = (field) => {
  switch (field.type) {
    case "number":
    case "integer":
      return "'not-a-number'";
    case "boolean":
      return "'not-a-boolean'";
    case "date":
      return "'not-a-date'";
    case "enum":
      return "'__invalid__'";
    case "ref":
      return "'not-an-id'";
    default:
      return "12345";
  }
};

/** Fields the list endpoint can search in (?search=...) */
const searchableFields = (fields) =>
  fields
    .filter((field) => field.type === "string" || field.type === "text")
    .map((field) => field.name);

/** Fields the list endpoint can sort by (?sort=...) */
const sortableFields = (fields, { withId = false } = {}) => [
  ...(withId ? ["id"] : []),
  ...fields.map((field) => field.name),
  "createdAt",
  "updatedAt",
];

module.exports = {
  literal,
  literalList,
  mongooseFields,
  sequelizeAttributes,
  sequelizeDeclarations,
  zodFields,
  invalidValue,
  searchableFields,
  sortableFields,
};
