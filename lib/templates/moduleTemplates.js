const { toCamelCase, moduleNames } = require("../utils/names");
const { DB_TYPES } = require("../utils/projectConfig");
const {
  literalList,
  mongooseFields,
  sequelizeAttributes,
  sequelizeDeclarations,
  zodFields,
  invalidValue,
  searchableFields,
  sortableFields,
} = require("./fieldTemplates");

/**
 * Every generator takes the same options object:
 * @typedef {object} ModuleOptions
 * @property {string} name - Module name as typed by the user (file names and URL path)
 * @property {"js"|"ts"} language - Project language
 * @property {string} dbType - Type of the connection the module uses (mongodb / postgres / mysql)
 * @property {string} connection - Name of that connection in src/config/databases
 * @property {import("../utils/fields").Field[]} fields - The module's fields
 * @property {boolean} [legacy] - Project generated before v1.2.0 (single mongoose.connect)
 * @property {{role?: string}} [auth] - Every route needs a logged-in user (with that role)
 */

const isSql = (dbType) => DB_TYPES[dbType].driver === "sql";

/** Blank lines inside indented blocks would otherwise carry trailing spaces */
const tidy = (code) => code.replace(/[ \t]+$/gm, "");

const generateMongoModel = ({ name, language, connection, legacy, fields }) => {
  const { singularCamel, singularPascal, model } = moduleNames(name);

  const schema = `{
${mongooseFields(fields, { ts: language === "ts" })}
}, {
  timestamps: true // Adds createdAt and updatedAt automatically
}`;

  if (language === "ts") {
    return `
import { Schema, type InferSchemaType } from 'mongoose';
import { getMongoConnection } from '../../config/mongodb';

// Define the schema for ${name}
const ${singularCamel}Schema = new Schema(${schema});

export type ${singularPascal}Document = InferSchemaType<typeof ${singularCamel}Schema>;

// The model lives on the "${connection}" connection (see src/config/databases.ts)
const ${model} = getMongoConnection('${connection}').model('${singularPascal}', ${singularCamel}Schema);

export default ${model};
`;
  }

  if (legacy) {
    return `
const mongoose = require('mongoose');

// Define the schema for ${name}
const ${singularCamel}Schema = new mongoose.Schema(${schema});

// Create and export the model
const ${model} = mongoose.model('${singularPascal}', ${singularCamel}Schema);

module.exports = ${model};
`;
  }

  return `
const mongoose = require('mongoose');
const { getMongoConnection } = require('../../config/mongodb');

// Define the schema for ${name}
const ${singularCamel}Schema = new mongoose.Schema(${schema});

// The model lives on the "${connection}" connection (see src/config/databases.js)
const ${model} = getMongoConnection('${connection}').model('${singularPascal}', ${singularCamel}Schema);

module.exports = ${model};
`;
};

const generateSqlModel = ({ name, language, connection, fields }) => {
  const { singularPascal, model, table } = moduleNames(name);

  if (language === "ts") {
    return `
import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
} from 'sequelize';
import { getSqlConnection } from '../../config/sql';

class ${model} extends Model<InferAttributes<${model}>, InferCreationAttributes<${model}>> {
  declare id: CreationOptional<number>;
${sequelizeDeclarations(fields)}
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

${model}.init({
${sequelizeAttributes(fields, { withId: true })},
  createdAt: DataTypes.DATE,
  updatedAt: DataTypes.DATE
}, {
  // The model lives on the "${connection}" connection (see src/config/databases.ts)
  sequelize: getSqlConnection('${connection}'),
  modelName: '${singularPascal}',
  tableName: '${table}',
  timestamps: true // Maintains createdAt and updatedAt automatically
});

export default ${model};
`;
  }

  return `
const { DataTypes } = require('sequelize');
const { getSqlConnection } = require('../../config/sql');

// The model lives on the "${connection}" connection (see src/config/databases.js)
const sequelize = getSqlConnection('${connection}');

// Define the model for ${name} (an auto-increment "id" primary key is added automatically)
const ${model} = sequelize.define('${singularPascal}', {
${sequelizeAttributes(fields)}
}, {
  tableName: '${table}',
  timestamps: true // Adds createdAt and updatedAt automatically
});

module.exports = ${model};
`;
};

/**
 * Generate the model file of a module
 * @param {ModuleOptions} options
 * @returns {string} - Model file content
 */
const generateModelContent = (options) =>
  isSql(options.dbType) ? generateSqlModel(options) : generateMongoModel(options);

/**
 * Generate the validation file of a module: Zod schemas for the request body
 * @param {ModuleOptions} options
 * @returns {string} - Validation file content
 */
const generateValidationContent = ({ name, language, dbType, fields }) => {
  const { singularPascal } = moduleNames(name);
  const createSchema = `create${singularPascal}Schema`;
  const updateSchema = `update${singularPascal}Schema`;
  const exported = language === "ts" ? "export " : "";

  const schemas = `// Body of POST /${name}. Fields that are not listed here are removed from the request.
${exported}const ${createSchema} = z.object({
${zodFields(fields, { driver: dbType ? DB_TYPES[dbType].driver : "mongodb" })}
});

// Body of PATCH /${name}/:id: any of the fields above, but at least one
${exported}const ${updateSchema} = ${createSchema}
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update'
  });`;

  if (language === "ts") {
    return `
import { z } from 'zod';

${schemas}

export type Create${singularPascal}Input = z.infer<typeof ${createSchema}>;
export type Update${singularPascal}Input = z.infer<typeof ${updateSchema}>;
`;
  }

  return `
const { z } = require('zod');

${schemas}

module.exports = { ${createSchema}, ${updateSchema} };
`;
};

/** The database calls of each CRUD handler, per driver */
const queries = {
  mongodb: (model, { searchable }) => ({
    helper: "",
    list: searchable
      ? [
          `const { page, limit, offset, sort, search } = parseListQuery(req.query, { sortable: SORTABLE_FIELDS, tieBreaker: '_id' });`,
          `const filter = search`,
          `  ? { $or: SEARCHABLE_FIELDS.map((field) => ({ [field]: { $regex: escapeRegex(search), $options: 'i' } })) }`,
          `  : {};`,
          ``,
          `const [items, total] = await Promise.all([`,
          `  ${model}.find(filter).sort(sort).skip(offset).limit(limit),`,
          `  ${model}.countDocuments(filter)`,
          `]);`,
        ]
      : [
          `const { page, limit, offset, sort } = parseListQuery(req.query, { sortable: SORTABLE_FIELDS, tieBreaker: '_id' });`,
          ``,
          `const [items, total] = await Promise.all([`,
          `  ${model}.find().sort(sort).skip(offset).limit(limit),`,
          `  ${model}.countDocuments()`,
          `]);`,
        ],
    get: [`const item = await ${model}.findById(req.params.id);`],
    create: [`const item = await ${model}.create(req.body);`],
    update: [
      `const item = await ${model}.findByIdAndUpdate(req.params.id, req.body, {`,
      `  returnDocument: 'after',`,
      `  runValidators: true`,
      `});`,
    ],
    remove: [`const item = await ${model}.findByIdAndDelete(req.params.id);`],
  }),

  sql: (model, { ts, searchable }) => ({
    helper: `
// Ids are auto-increment integers - anything else cannot match a row
async function findById(value${ts ? ": string" : ""})${ts ? `: Promise<${model} | null>` : ""} {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? ${model}.findByPk(id) : null;
}
`,
    list: searchable
      ? [
          `const { page, limit, offset, sort, search } = parseListQuery(req.query, { sortable: SORTABLE_FIELDS, tieBreaker: 'id' });`,
          `const where${ts ? ": WhereOptions" : ""} = search`,
          `  ? { [Op.or]: SEARCHABLE_FIELDS.map((field) => ({ [field]: { [LIKE]: \`%\${escapeLike(search)}%\` } })) }`,
          `  : {};`,
          ``,
          `const { rows: items, count: total } = await ${model}.findAndCountAll({ where, order: sort, offset, limit });`,
        ]
      : [
          `const { page, limit, offset, sort } = parseListQuery(req.query, { sortable: SORTABLE_FIELDS, tieBreaker: 'id' });`,
          ``,
          `const { rows: items, count: total } = await ${model}.findAndCountAll({ order: sort, offset, limit });`,
        ],
    get: [`const item = await findById(req.params.id);`],
    create: [`const item = await ${model}.create(req.body);`],
    update: [`const item = await findById(req.params.id);`],
    afterUpdate: [`await item.update(req.body);`],
    remove: [`const item = await findById(req.params.id);`],
    afterRemove: [`await item.destroy();`],
  }),
};

/**
 * Generate the controller file of a module
 * @param {ModuleOptions} options
 * @returns {string} - Controller file content
 */
const generateControllerContent = ({ name, language, dbType, fields }) => {
  const ts = language === "ts";
  const sql = isSql(dbType);
  const { model, singularLabel, pluralLabel } = moduleNames(name);
  const searchable = searchableFields(fields);
  const sortable = sortableFields(fields, { withId: sql });
  const hasSearch = searchable.length > 0;
  const query = queries[DB_TYPES[dbType].driver](model, { ts, searchable: hasSearch });

  // Helpers this controller needs from src/utils/listQuery
  const helpers = [
    ...(hasSearch ? [sql ? "escapeLike" : "escapeRegex"] : []),
    "paginate",
    "parseListQuery",
  ].join(", ");

  const imports = ts
    ? [
        `import type { NextFunction, Request, Response } from 'express';`,
        ...(sql && hasSearch ? [`import { Op, type WhereOptions } from 'sequelize';`] : []),
        `import ${model} from './${name}.model';`,
        `import { ${helpers} } from '../../utils/listQuery';`,
        ``,
        `type IdParams = { id: string };`,
      ]
    : [
        ...(sql && hasSearch ? [`const { Op } = require('sequelize');`] : []),
        `const ${model} = require('./${name}.model');`,
        `const { ${helpers} } = require('../../utils/listQuery');`,
      ];

  const constants = [
    ``,
    `// Fields accepted by ?sort=${hasSearch ? ", and fields ?search= looks in" : ""}`,
    `const SORTABLE_FIELDS = ${literalList(sortable)};`,
    ...(hasSearch ? [`const SEARCHABLE_FIELDS = ${literalList(searchable)};`] : []),
    ...(sql && hasSearch
      ? [
          ``,
          `// LIKE is case-sensitive in PostgreSQL, so ILIKE is used there`,
          `const LIKE = ${model}.sequelize?.getDialect() === 'postgres' ? Op.iLike : Op.like;`,
        ]
      : []),
  ];

  const footer = ts
    ? ""
    : `
module.exports = {
  getAll,
  getById,
  create,
  update,
  remove
};`;

  /** One request handler: run the query, 404 when nothing matched, respond */
  const handler = ({ fn, doc, lines, after = [], byId, result, status, message, pagination }) => {
    const signature = ts
      ? `export async function ${fn}(req: Request${byId ? "<IdParams>" : ""}, res: Response, next: NextFunction): Promise<void> {`
      : `async function ${fn}(req, res, next) {`;

    const notFound = byId
      ? `

    if (!item) {
      res.status(404).json({
        success: false,
        message: '${singularLabel} not found'
      });
      return;
    }`
      : "";

    return `
/**
 * ${doc}
 */
${signature}
  try {
    ${lines.join("\n    ")}${notFound}
${after.map((line) => `\n    ${line}\n`).join("")}
    res${status ? `.status(${status})` : ""}.json({
      success: true,
      data: ${result},${pagination ? "\n      pagination: paginate(total, page, limit)," : ""}
      message: '${message} successfully'
    });
  } catch (error) {
    next(error);
  }
}`;
  };

  const handlers = [
    {
      fn: "getAll",
      doc: `List ${pluralLabel.toLowerCase()}: ?page=1&limit=20&sort=-createdAt${hasSearch ? "&search=text" : ""}`,
      lines: query.list,
      result: "items",
      pagination: true,
      message: `${pluralLabel} retrieved`,
    },
    {
      fn: "getById",
      doc: `Get one ${singularLabel.toLowerCase()} by id`,
      lines: query.get,
      byId: true,
      result: "item",
      message: `${singularLabel} retrieved`,
    },
    {
      fn: "create",
      doc: `Create a ${singularLabel.toLowerCase()} (the route validates the body first)`,
      lines: query.create,
      result: "item",
      status: 201,
      message: `${singularLabel} created`,
    },
    {
      fn: "update",
      doc: `Update a ${singularLabel.toLowerCase()} by id (the route validates the body first)`,
      lines: query.update,
      after: query.afterUpdate,
      byId: true,
      result: "item",
      message: `${singularLabel} updated`,
    },
    {
      fn: "remove",
      doc: `Delete a ${singularLabel.toLowerCase()} by id`,
      lines: query.remove,
      after: query.afterRemove,
      byId: true,
      result: "item",
      message: `${singularLabel} deleted`,
    },
  ];

  return tidy(`
${imports.join("\n")}
${constants.join("\n")}
${query.helper}${handlers.map(handler).join("\n")}
${footer}
`);
};

/**
 * Generate the routes file of a module
 * @param {ModuleOptions} options
 * @returns {string} - Routes file content
 */
const generateRouteContent = ({ name, language, auth }) => {
  const { singularPascal } = moduleNames(name);
  const camel = toCamelCase(name);
  const createSchema = `create${singularPascal}Schema`;
  const updateSchema = `update${singularPascal}Schema`;
  const guard = auth ? (auth.role ? "requireRole" : "requireAuth") : null;

  const guardSetup = !auth
    ? ""
    : auth.role
      ? `// Every route below needs a logged-in user with the "${auth.role}" role
router.use(requireRole('${auth.role}'));

`
      : `// Every route below needs a logged-in user (Authorization: Bearer <access token>)
router.use(requireAuth);

`;

  const routes = `${guardSetup}// CRUD routes
router.get('/', ${camel}Controller.getAll);
router.get('/:id', ${camel}Controller.getById);
router.post('/', validate(${createSchema}), ${camel}Controller.create);
router.patch('/:id', validate(${updateSchema}), ${camel}Controller.update);
router.delete('/:id', ${camel}Controller.remove);`;

  if (language === "ts") {
    return `
import { Router } from 'express';
import validate from '../../middleware/validate';${guard ? `\nimport { ${guard} } from '../../middleware/auth';` : ""}
import * as ${camel}Controller from './${name}.controller';
import { ${createSchema}, ${updateSchema} } from './${name}.validation';

const router = Router();

${routes}

export default router;
`;
  }

  return `
const express = require('express');
const validate = require('../../middleware/validate');${guard ? `\nconst { ${guard} } = require('../../middleware/auth');` : ""}
const ${camel}Controller = require('./${name}.controller');
const { ${createSchema}, ${updateSchema} } = require('./${name}.validation');

const router = express.Router();

${routes}

module.exports = router;
`;
};

/**
 * Generate tests/<module>.test - request checks that need no database
 * @param {ModuleOptions} options
 * @returns {string} - Test file content
 */
const generateModuleTest = ({ name, language, fields, auth }) => {
  const [first] = fields;
  const ts = language === "ts";
  const role = auth?.role || "user";

  const imports = ts
    ? `import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app';${auth ? "\nimport { signAccessToken } from '../src/utils/security';" : ""}`
    : `const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');${auth ? "\nconst { signAccessToken } = require('../src/utils/security');" : ""}`;

  // Access tokens for test users, signed with a test secret
  const authSetup = !auth
    ? ""
    : `
// Tests sign their own access tokens with a test secret (read on first use)
process.env.JWT_SECRET ??= 'test-secret-that-is-at-least-32-characters-long';
const tokenFor = (role${ts ? ": string" : ""}) => \`Bearer \${signAccessToken({ id: '1', role }).accessToken}\`;
`;

  const withToken = auth ? `.set('Authorization', tokenFor('${role}'))` : "";

  const authTests = !auth
    ? ""
    : `
test('/${name} needs a logged-in user', async () => {
  const response = await request(app).get('/${name}');

  assert.equal(response.status, 401);
});
${
  auth.role && auth.role !== "user"
    ? `
test('/${name} needs the "${auth.role}" role', async () => {
  const response = await request(app).get('/${name}').set('Authorization', tokenFor('user'));

  assert.equal(response.status, 403);
});
`
    : ""
}`;

  return `
${imports}
${authSetup}
// These tests stop before the database (authentication and validation), so they run without one.
${authTests}
test('POST /${name} rejects an invalid body', async () => {
  const response = await request(app).post('/${name}')${withToken}.send({ ${first.name}: ${invalidValue(first)} });

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
  assert.ok(response.body.errors.some((error${ts ? ": { field: string }" : ""}) => error.field === '${first.name}'));
});

test('PATCH /${name}/:id rejects an empty body', async () => {
  const response = await request(app).patch('/${name}/1')${withToken}.send({});

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
});
`;
};

/**
 * Statements that register a module's routes in the server file
 * @param {string} name - Module name
 * @param {"js"|"ts"} language - Project language
 * @returns {{identifier: string, importStatement: string, middlewareStatement: string}}
 */
const routeRegistration = (name, language) => {
  const identifier = `${toCamelCase(name)}Routes`;
  const modulePath = `./modules/${name}/${name}.routes`;

  return {
    identifier,
    importStatement:
      language === "ts"
        ? `import ${identifier} from '${modulePath}';`
        : `const ${identifier} = require('${modulePath}');`,
    middlewareStatement: `app.use('/${name}', ${identifier});`,
  };
};

module.exports = {
  generateModelContent,
  generateValidationContent,
  generateControllerContent,
  generateRouteContent,
  generateModuleTest,
  routeRegistration,
};
