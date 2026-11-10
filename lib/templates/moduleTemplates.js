const { toCamelCase, toPascalCase, toSnakeCase } = require("../utils/names");
const { DB_TYPES } = require("../utils/projectConfig");

/**
 * Every generator takes the same options object:
 * @typedef {object} ModuleOptions
 * @property {string} name - Module name as typed by the user (file names and URL path)
 * @property {"js"|"ts"} language - Project language
 * @property {string} dbType - Type of the connection the module uses (mongodb / postgres / mysql)
 * @property {string} connection - Name of that connection in src/config/databases
 * @property {boolean} [legacy] - Project generated before v1.2.0 (single mongoose.connect)
 */

/** Identifiers derived from the module name: user-profile -> userProfile / UserProfile */
const identifiers = (name) => {
  const pascal = toPascalCase(name);
  return {
    camel: toCamelCase(name),
    pascal,
    // The "Model" suffix keeps the variable from shadowing globals (Object, Promise, ...)
    model: `${pascal}Model`,
    table: toSnakeCase(name),
  };
};

const mongoSchemaFields = `{
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  }
}, {
  timestamps: true // Adds createdAt and updatedAt automatically
}`;

const generateMongoModel = ({ name, language, connection, legacy }) => {
  const { camel, pascal, model } = identifiers(name);

  if (language === "ts") {
    return `
import { Schema, type InferSchemaType } from 'mongoose';
import { getMongoConnection } from '../../config/mongodb';

// Define the schema for ${name}
const ${camel}Schema = new Schema(${mongoSchemaFields});

export type ${pascal}Document = InferSchemaType<typeof ${camel}Schema>;

// The model lives on the "${connection}" connection (see src/config/databases.ts)
const ${model} = getMongoConnection('${connection}').model('${pascal}', ${camel}Schema);

export default ${model};
`;
  }

  if (legacy) {
    return `
const mongoose = require('mongoose');

// Define the schema for ${name}
const ${camel}Schema = new mongoose.Schema(${mongoSchemaFields});

// Create and export the model
const ${model} = mongoose.model('${pascal}', ${camel}Schema);

module.exports = ${model};
`;
  }

  return `
const mongoose = require('mongoose');
const { getMongoConnection } = require('../../config/mongodb');

// Define the schema for ${name}
const ${camel}Schema = new mongoose.Schema(${mongoSchemaFields});

// The model lives on the "${connection}" connection (see src/config/databases.js)
const ${model} = getMongoConnection('${connection}').model('${pascal}', ${camel}Schema);

module.exports = ${model};
`;
};

const generateSqlModel = ({ name, language, connection }) => {
  const { pascal, model, table } = identifiers(name);

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
  declare name: string;
  declare description: CreationOptional<string | null>;
  declare status: CreationOptional<'active' | 'inactive'>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

${model}.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: { notEmpty: true }
  },
  description: {
    type: DataTypes.TEXT
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    allowNull: false,
    defaultValue: 'active',
    validate: { isIn: [['active', 'inactive']] }
  },
  createdAt: DataTypes.DATE,
  updatedAt: DataTypes.DATE
}, {
  // The model lives on the "${connection}" connection (see src/config/databases.ts)
  sequelize: getSqlConnection('${connection}'),
  modelName: '${pascal}',
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

// Define the table for ${name} (an auto-increment "id" primary key is added automatically)
const ${model} = sequelize.define('${pascal}', {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: { notEmpty: true }
  },
  description: {
    type: DataTypes.TEXT
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    allowNull: false,
    defaultValue: 'active',
    validate: { isIn: [['active', 'inactive']] }
  }
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
  DB_TYPES[options.dbType].driver === "mongodb"
    ? generateMongoModel(options)
    : generateSqlModel(options);

/** The database calls of each CRUD handler, per driver */
const queries = {
  mongodb: (model) => ({
    helper: "",
    list: [`const items = await ${model}.find().sort({ createdAt: -1 });`],
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
  sql: (model, ts) => ({
    helper: `
// Ids are auto-increment integers - anything else cannot match a row
async function findById(value${ts ? ": string" : ""})${ts ? `: Promise<${model} | null>` : ""} {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? ${model}.findByPk(id) : null;
}
`,
    list: [`const items = await ${model}.findAll({ order: [['createdAt', 'DESC']] });`],
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
const generateControllerContent = ({ name, language, dbType }) => {
  const ts = language === "ts";
  const { pascal, model } = identifiers(name);
  const query = queries[DB_TYPES[dbType].driver](model, ts);

  const header = ts
    ? `import type { NextFunction, Request, Response } from 'express';
import ${model} from './${name}.model';

type IdParams = { id: string };`
    : `const ${model} = require('./${name}.model');`;

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
  const handler = ({ fn, doc, lines, after = [], byId, result, status, message }) => {
    const signature = ts
      ? `export async function ${fn}(req: Request${byId ? "<IdParams>" : ""}, res: Response, next: NextFunction): Promise<void> {`
      : `async function ${fn}(req, res, next) {`;

    const notFound = byId
      ? `

    if (!item) {
      res.status(404).json({
        success: false,
        message: '${pascal} not found'
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
      data: ${result},
      message: '${pascal} ${message} successfully'
    });
  } catch (error) {
    next(error);
  }
}`;
  };

  const handlers = [
    { fn: "getAll", doc: `Get all ${name} records`, lines: query.list, result: "items", message: "retrieved" },
    { fn: "getById", doc: `Get a single ${name} record by ID`, lines: query.get, byId: true, result: "item", message: "retrieved" },
    { fn: "create", doc: `Create a new ${name} record`, lines: query.create, result: "item", status: 201, message: "created" },
    { fn: "update", doc: `Update a ${name} record by ID`, lines: query.update, after: query.afterUpdate, byId: true, result: "item", message: "updated" },
    { fn: "remove", doc: `Delete a ${name} record by ID`, lines: query.remove, after: query.afterRemove, byId: true, result: "item", message: "deleted" },
  ];

  return `
${header}
${query.helper}${handlers.map(handler).join("\n")}
${footer}
`;
};

/**
 * Generate the routes file of a module
 * @param {ModuleOptions} options
 * @returns {string} - Routes file content
 */
const generateRouteContent = ({ name, language }) => {
  const { camel } = identifiers(name);

  const routes = `// CRUD routes
router.get('/', ${camel}Controller.getAll);
router.get('/:id', ${camel}Controller.getById);
router.post('/', ${camel}Controller.create);
router.patch('/:id', ${camel}Controller.update);
router.delete('/:id', ${camel}Controller.remove);`;

  if (language === "ts") {
    return `
import { Router } from 'express';
import * as ${camel}Controller from './${name}.controller';

const router = Router();

${routes}

export default router;
`;
  }

  return `
const express = require('express');
const router = express.Router();
const ${camel}Controller = require('./${name}.controller');

${routes}

module.exports = router;
`;
};

/**
 * Statements that register a module's routes in src/index
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
  generateControllerContent,
  generateRouteContent,
  routeRegistration,
};
