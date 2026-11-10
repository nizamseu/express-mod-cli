const { CliError } = require("./errors");

/**
 * Field definitions of a module, given on the command line:
 *
 *   express-mod-cli add products name:string price:number stock:integer:default=0
 *
 * @typedef {object} Field
 * @property {string} name
 * @property {"string"|"text"|"number"|"integer"|"boolean"|"date"|"enum"} type
 * @property {string[]} [values] - Allowed values (enum only)
 * @property {boolean} optional - May be omitted or null
 * @property {boolean} unique - Unique index
 * @property {boolean} hasDefault
 * @property {string|number|boolean} [default]
 * @property {boolean} required - Must be sent when creating a record (not optional, no default)
 */

const TYPES = ["string", "text", "number", "integer", "boolean", "date", "enum"];
const TYPE_ALIASES = {
  str: "string",
  int: "integer",
  float: "number",
  bool: "boolean",
};

// Added to every model automatically
const RESERVED_NAMES = ["id", "_id", "__v", "createdAt", "updatedAt"];
const FIELD_NAME = /^[a-zA-Z][a-zA-Z0-9_]*$/;
const ENUM_VALUE = /^[a-zA-Z0-9][a-zA-Z0-9 _-]*$/;

/** Used when "add" is called without fields (the fields every module had before v1.3.0) */
const DEFAULT_FIELD_SPECS = [
  "name:string",
  "description:text:optional",
  "status:enum:active,inactive:default=active",
];

const FIELD_HELP = `
Field format: <name>:<type>[:optional][:unique][:default=<value>]
Types:        ${TYPES.filter((type) => type !== "enum").join(", ")}, enum:<value1,value2,...>
Example:      name:string price:number status:enum:draft,published:default=draft`;

/**
 * Convert the text after "default=" to a value of the field's type
 */
function parseDefault(type, text, values, fail) {
  switch (type) {
    case "number":
    case "integer": {
      const number = Number(text);
      const valid =
        text.trim() !== "" &&
        (type === "integer" ? Number.isInteger(number) : Number.isFinite(number));
      if (!valid) fail(`default "${text}" is not ${type === "integer" ? "an integer" : "a number"}`);
      return number;
    }
    case "boolean":
      if (text !== "true" && text !== "false") fail(`default must be true or false`);
      return text === "true";
    case "enum":
      if (!values.includes(text)) fail(`default "${text}" is not one of: ${values.join(", ")}`);
      return text;
    case "string":
      if (/[\r\n]/.test(text)) fail("default cannot contain line breaks");
      return text;
    default:
      // TEXT columns can't have a default in MySQL; dates would need a database function
      return fail(`a default is not supported for ${type} fields`);
  }
}

/**
 * Parse one field definition
 * @param {string} spec - e.g. "price:number:optional"
 * @returns {Field}
 */
function parseField(spec) {
  const fail = (reason) => {
    throw new CliError(`Invalid field "${spec}": ${reason}\n${FIELD_HELP}`);
  };

  const [name, rawType, ...rest] = spec.split(":");

  if (!FIELD_NAME.test(name)) {
    fail(`"${name}" is not a valid field name (letters, numbers and "_", starting with a letter)`);
  }
  if (RESERVED_NAMES.includes(name)) {
    fail(`"${name}" is added automatically and cannot be redefined`);
  }
  if (!rawType) {
    fail("the type is missing");
  }

  const type = TYPE_ALIASES[rawType.toLowerCase()] || rawType.toLowerCase();
  if (!TYPES.includes(type)) {
    fail(`unknown type "${rawType}"`);
  }

  const field = { name, type, optional: false, unique: false, hasDefault: false };

  if (type === "enum") {
    const values = (rest.shift() || "").split(",").filter(Boolean);
    if (values.length === 0) fail("list the allowed values, e.g. status:enum:draft,published");
    const invalid = values.find((value) => !ENUM_VALUE.test(value));
    if (invalid) fail(`"${invalid}" is not a valid enum value (letters, numbers, spaces, "-" and "_")`);
    if (new Set(values).size !== values.length) fail("enum values must be different from each other");
    field.values = values;
  }

  while (rest.length > 0) {
    const modifier = rest.shift();

    if (modifier === "optional") {
      field.optional = true;
    } else if (modifier === "required") {
      // The default - accepted so it can be written explicitly
    } else if (modifier === "unique") {
      field.unique = true;
    } else if (modifier.startsWith("default=")) {
      // A default takes the rest of the definition, so it may contain ":" (default=http://...)
      const text = [modifier.slice("default=".length), ...rest.splice(0)].join(":");
      field.default = parseDefault(type, text, field.values, fail);
      field.hasDefault = true;
    } else {
      fail(`unknown option "${modifier}"`);
    }
  }

  if (field.unique && type === "text") {
    fail("text fields cannot be unique - use string instead");
  }

  field.required = !field.optional && !field.hasDefault;
  return field;
}

/**
 * Parse the field definitions of a module
 * @param {string[]} specs - Field definitions; empty for the default fields
 * @returns {Field[]}
 */
function parseFields(specs = []) {
  const fields = (specs.length > 0 ? specs : DEFAULT_FIELD_SPECS).map(parseField);

  const seen = new Set();
  for (const { name } of fields) {
    if (seen.has(name)) {
      throw new CliError(`Field "${name}" is defined more than once.`);
    }
    seen.add(name);
  }

  return fields;
}

module.exports = { parseFields, FIELD_HELP };
