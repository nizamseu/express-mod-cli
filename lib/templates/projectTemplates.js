const { DB_TYPES } = require("../utils/projectConfig");
const { generateConnectionEnv } = require("./dbTemplates");

/** Sort an object's keys, the way npm keeps dependency lists */
const sortKeys = (object) =>
  Object.fromEntries(
    Object.entries(object).sort(([a], [b]) => a.localeCompare(b))
  );

/** Packages every module needs (request validation) */
const MODULE_DEPENDENCIES = { zod: "^4.6.7" };

/** Dev packages the generated tests need */
const testDevDependencies = (language) =>
  language === "ts"
    ? { supertest: "^7.3.2", "@types/supertest": "^7.2.1" }
    : { supertest: "^7.3.2" };

/**
 * npm scripts that run SQL migrations (projects with a PostgreSQL / MySQL connection)
 * @param {"js"|"ts"} language - Project language
 * @returns {object} - Scripts to merge into package.json
 */
const migrationScripts = (language) => {
  const run =
    language === "ts" ? "tsx src/scripts/migrate.ts" : "node src/scripts/migrate.js";

  return {
    migrate: `${run} up`,
    "migrate:down": `${run} down`,
    "migrate:status": `${run} status`,
  };
};

/**
 * Generate package.json content for new projects
 * @param {string} projectName - The name of the project
 * @param {{language: "js"|"ts", dbType: string}} options - Project setup
 * @returns {object} - Package.json object
 */
const generatePackageJson = (projectName, { language, dbType }) => {
  // npm package names must be lowercase
  const packageName = projectName.toLowerCase();
  const sql = DB_TYPES[dbType].driver === "sql";

  // Version ranges instead of "latest", so a new major release
  // of a dependency cannot break freshly generated projects.
  const dependencies = sortKeys({
    express: "^5.3.0",
    dotenv: "^18.0.10",
    cors: "^2.8.6",
    helmet: "^8.3.0",
    ...MODULE_DEPENDENCIES,
    ...DB_TYPES[dbType].dependencies,
  });

  if (language === "ts") {
    return {
      name: packageName,
      version: "1.0.0",
      description: "Express application with MVC architecture",
      main: "dist/index.js",
      scripts: {
        dev: "tsx watch src/index.ts",
        build: "tsc",
        start: "node dist/index.js",
        typecheck: "tsc --noEmit",
        test: 'tsx --test "tests/**/*.test.ts"',
        ...(sql ? migrationScripts(language) : {}),
      },
      dependencies,
      devDependencies: sortKeys({
        "@types/cors": "^2.8.19",
        "@types/express": "^5.0.6",
        "@types/node": "^24.0.0",
        tsx: "^4.23.15",
        typescript: "^7.0.2",
        ...testDevDependencies(language),
      }),
    };
  }

  return {
    name: packageName,
    version: "1.0.0",
    description: "Express application with MVC architecture",
    main: "src/index.js",
    scripts: {
      start: "node src/index.js",
      dev: "nodemon src/index.js",
      test: "node --test",
      ...(sql ? migrationScripts(language) : {}),
    },
    dependencies,
    devDependencies: sortKeys({
      nodemon: "^3.1.14",
      ...testDevDependencies(language),
    }),
  };
};

/**
 * Generate tsconfig.json content (TypeScript projects)
 * @returns {object} - tsconfig object
 */
const generateTsConfig = () => ({
  compilerOptions: {
    target: "ES2022",
    module: "nodenext",
    moduleResolution: "nodenext",
    rootDir: "src",
    outDir: "dist",
    strict: true,
    esModuleInterop: true,
    skipLibCheck: true,
    forceConsistentCasingInFileNames: true,
    types: ["node"],
  },
  include: ["src"],
});

/**
 * Generate src/config/env.ts (TypeScript projects).
 * Imports are hoisted, so .env has to be loaded by a module that is imported first.
 * @returns {string} - Env loader content
 */
const generateEnvLoader = () => {
  return `
import dotenv from 'dotenv';

// Load .env before any other module reads process.env
dotenv.config({ quiet: true });
`;
};

/** The part of the app file that is identical in JavaScript and TypeScript */
const appBody = `
const app = express();

// Security & utility middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Route middleware will be automatically added here
// ROUTE_MIDDLEWARE

// 404 handler for undefined routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: \`Route \${req.method} \${req.originalUrl} not found\`
  });
});

// Error handling middleware
app.use(errorHandler);
`;

/**
 * Generate src/app - the Express app with its middleware and routes.
 * It does not connect to a database or listen on a port, so tests can import it.
 * @param {"js"|"ts"} language - Project language
 * @returns {string} - App file content
 */
const generateAppContent = (language) => {
  if (language === "ts") {
    return `
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import errorHandler from './middleware/errorHandler';

// Route imports will be automatically added here
// ROUTE_IMPORTS
${appBody}
export default app;
`;
  }

  return `
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const errorHandler = require('./middleware/errorHandler');

// Route imports will be automatically added here
// ROUTE_IMPORTS
${appBody}
module.exports = app;
`;
};

/** The part of the server file that is identical in JavaScript and TypeScript */
const serverBody = (ts) => `
const PORT = Number(process.env.PORT) || 5000;

async function startServer()${ts ? ": Promise<void>" : ""} {
  try {
    await connectDB();
  } catch (err) {
    console.error('Failed to connect to the database:', err);
    process.exit(1);
  }

  const server = app.listen(PORT, (error) => {
    if (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
    console.log(\`Server running on port \${PORT}\`);
  });

  // Graceful shutdown: stop accepting requests, then close database connections
  const shutdown = (signal${ts ? ": string" : ""}) => {
    console.log(\`\${signal} received, shutting down...\`);
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

startServer();
`;

/**
 * Generate src/index - loads the environment, connects the databases and starts the server
 * @param {"js"|"ts"} language - Project language
 * @returns {string} - Server file content
 */
const generateServerContent = (language) => {
  if (language === "ts") {
    return `
import './config/env';
import app from './app';
import { connectDB, disconnectDB } from './config/db';
${serverBody(true)}`;
  }

  return `
require('dotenv').config({ quiet: true });
const app = require('./app');
const { connectDB, disconnectDB } = require('./config/db');
${serverBody(false)}`;
};

/**
 * Generate tests/app.test - checks that work without a database
 * @param {"js"|"ts"} language - Project language
 * @returns {string} - Test file content
 */
const generateAppTest = (language) => {
  const imports =
    language === "ts"
      ? `import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app';`
      : `const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');`;

  return `
${imports}

// The app is imported without starting the server or connecting to a database.
// "express-mod-cli add <module>" adds a test file for every module.

test('unknown routes return a JSON 404', async () => {
  const response = await request(app).get('/does-not-exist');

  assert.equal(response.status, 404);
  assert.equal(response.body.success, false);
});

test('malformed JSON returns a 400', async () => {
  const response = await request(app)
    .post('/does-not-exist')
    .set('Content-Type', 'application/json')
    .send('{"broken"');

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
});
`;
};

/** The error handler body, identical in JavaScript and TypeScript */
const errorHandlerBody = `
  if (res.headersSent) {
    next(err);
    return;
  }

  // Validation errors (Mongoose / Sequelize)
  if (err.name === 'ValidationError' || err.name === 'SequelizeValidationError') {
    res.status(400).json({
      success: false,
      message: err.message
    });
    return;
  }

  // Mongoose CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    res.status(400).json({
      success: false,
      message: \`Invalid \${err.path}: \${err.value}\`
    });
    return;
  }

  // Unique index violations (MongoDB duplicate key / Sequelize unique constraint)
  if (err.code === 11000 || err.name === 'SequelizeUniqueConstraintError') {
    res.status(409).json({
      success: false,
      message: 'A record with the same unique value already exists'
    });
    return;
  }

  const statusCode = err.statusCode || err.status || 500;

  if (statusCode >= 500) {
    console.error(err.stack);
  }

  // Don't leak internal error details to clients in production
  const hideDetails = statusCode >= 500 && process.env.NODE_ENV === 'production';

  res.status(statusCode).json({
    success: false,
    message: hideDetails ? 'Internal server error' : err.message || 'Internal server error'
  });
};`;

/**
 * Generate error handler middleware content
 * @param {"js"|"ts"} language - Project language
 * @returns {string} - Error handler content
 */
const generateErrorHandler = (language) => {
  if (language === "ts") {
    return `
import type { ErrorRequestHandler } from 'express';

interface AppError extends Error {
  statusCode?: number;
  status?: number;
  code?: number | string;
  path?: string;
  value?: unknown;
}

const errorHandler: ErrorRequestHandler = (err: AppError, req, res, next) => {${errorHandlerBody}

export default errorHandler;
`;
  }

  return `
const errorHandler = (err, req, res, next) => {${errorHandlerBody}

module.exports = errorHandler;
`;
};

/**
 * Generate .env file content (also used for .env.example)
 * @param {{dbType: string, dbName: string}} options - Default database setup
 * @returns {string} - Environment file content
 */
const generateEnvFile = ({ dbType, dbName }) => {
  return `
${generateConnectionEnv("default", dbType, dbName)}

# Server Configuration
PORT=5000
NODE_ENV=development

# API Configuration
API_VERSION=v1
`;
};

/**
 * Generate .gitignore content
 * @returns {string} - Gitignore content
 */
const generateGitignore = () => {
  return `
node_modules/
.env
*.log
dist/
coverage/
.nyc_output/
.DS_Store
`;
};

module.exports = {
  MODULE_DEPENDENCIES,
  testDevDependencies,
  migrationScripts,
  sortKeys,
  generatePackageJson,
  generateTsConfig,
  generateEnvLoader,
  generateAppContent,
  generateServerContent,
  generateAppTest,
  generateErrorHandler,
  generateEnvFile,
  generateGitignore,
};
