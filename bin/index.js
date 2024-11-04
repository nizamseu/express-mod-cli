#!/usr/bin/env node

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Get the command and the argument
const args = process.argv.slice(2);
const command = args[0];
const name = args[1];

console.log("Command:", command);
console.log("Name:", name);

if (!command) {
  console.error("Please provide a command (e.g., create or add).");
  process.exit(1);
}

// Helper function to create files and directories
const createFile = (filePath, content) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, content.trim() + "\n");
};

// Command handling
switch (command) {
  case "create":
    if (!name) {
      console.error("Please provide a project name.");
      process.exit(1);
    }
    createProject(name);
    break;

  case "add":
    if (!name) {
      console.error("Please provide a module name.");
      process.exit(1);
    }
    addModule(name);
    break;

  default:
    console.error(`Unknown command: ${command}. Use "create" or "add".`);
    break;
}

function createProject(projectName) {
  const projectPath = path.join(process.cwd(), projectName);

  if (fs.existsSync(projectPath)) {
    console.error(`Directory ${projectName} already exists!`);
    process.exit(1);
  }

  console.log(`Creating a new Express project in ${projectPath}`);

  // Create project directory
  fs.mkdirSync(projectPath);

  // Create package.json
  const packageJson = {
    name: projectName,
    version: "1.0.0",
    description: "Express application with MVC architecture",
    main: "src/index.js",
    scripts: {
      start: "node src/index.js",
      dev: "nodemon src/index.js",
    },
    dependencies: {
      express: "^4.17.1",
      mongodb: "^4.1.0",
      dotenv: "^10.0.0",
      cors: "^2.8.5",
      helmet: "^4.6.0",
    },
    devDependencies: {
      nodemon: "^2.0.12",
    },
  };

  fs.writeFileSync(
    path.join(projectPath, "package.json"),
    JSON.stringify(packageJson, null, 2)
  );

  // Install dependencies
  console.log("Installing dependencies...");
  execSync("npm install", { cwd: projectPath, stdio: "inherit" });

  // Create src directory structure
  const srcPath = path.join(projectPath, "src");
  fs.mkdirSync(srcPath);
  fs.mkdirSync(path.join(srcPath, "config"));
  fs.mkdirSync(path.join(srcPath, "middleware"));
  fs.mkdirSync(path.join(srcPath, "modules"));
  fs.mkdirSync(path.join(srcPath, "utils"));

  // Create main server file
  const serverContent = `
const express = require('express');
const { connectDB } = require('./config/db');
const cors = require('cors');
const helmet = require('helmet');

// Import middleware
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Middleware
app.use(express.json());
app.use(cors());
app.use(helmet());

// Route imports will be automatically added here
// ROUTE_IMPORTS

// Route middleware will be automatically added here
// ROUTE_MIDDLEWARE

// Error handling middleware
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(\`Server running on port \${PORT}\`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
`;

  createFile(path.join(srcPath, "index.js"), serverContent);

  // Create database configuration
  const dbConfig = `
const { MongoClient } = require('mongodb');
require('dotenv').config();

let db = null;

async function connectDB() {
  try {
    const client = await MongoClient.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    db = client.db(process.env.DB_NAME);
    console.log('Connected to MongoDB');
    return db;
  } catch (err) {
    console.error('MongoDB connection error:', err);
    throw err;
  }
}

function getDB() {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}

module.exports = { connectDB, getDB };
`;

  createFile(path.join(srcPath, "config", "db.js"), dbConfig);

  // Create error handler middleware
  const errorHandlerContent = `
const errorHandler = (err, req, res, next) => {
  console.error(err.stack);

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      status: 'error',
      message: err.message
    });
  }

  res.status(500).json({
    status: 'error',
    message: 'Internal server error'
  });
};

module.exports = errorHandler;
`;

  createFile(
    path.join(srcPath, "middleware", "errorHandler.js"),
    errorHandlerContent
  );

  // Create .env file
  const envContent = `
MONGODB_URI=mongodb://localhost:27017
DB_NAME=${projectName}_db
PORT=5000
`;
  createFile(path.join(projectPath, ".env"), envContent);

  // Create .gitignore
  const gitignoreContent = `
node_modules/
.env
*.log
`;
  createFile(path.join(projectPath, ".gitignore"), gitignoreContent);

  console.log(`
    Express project "${projectName}" created successfully!
    
    To get started:
      cd ${projectName}
      npm run dev
      
    1. Update MongoDB URI:
       - Open the .env file located in the root of the project directory.
       - Replace the placeholder MongoDB URI with your actual MongoDB URI.
       - Example:
         MONGODB_URI=mongodb://localhost:27017/${projectName}_db
    
    2. Add your database name:
       - You can specify the database name directly in the MongoDB URI as shown above, 
         or set it as a separate environment variable:
         DB_NAME=${projectName}_db
    
    3. Example .env file setup:
       - MONGODB_URI=mongodb://localhost:27017/${projectName}_db
       - DB_NAME=${projectName}_db
       - PORT=5000
    
    4. Save the .env file and restart the server to apply changes.
    
    To add new modules:
      npx express-mod-cli add <module-name>
    `);
}

function addModule(moduleName) {
  const projectPath = process.cwd();

  if (!fs.existsSync(path.join(projectPath, "package.json"))) {
    console.error(
      "Please run this command from the root of your Express project."
    );
    process.exit(1);
  }

  console.log(`Adding new module: ${moduleName}`);

  const moduleDir = path.join(projectPath, "src", "modules", moduleName);
  fs.mkdirSync(moduleDir, { recursive: true });

  // Create model
  const modelContent = `
const { getDB } = require('../../config/db');
const { ObjectId } = require('mongodb');

const COLLECTION_NAME = '${moduleName}';

async function findAll() {
  const db = getDB();
  return await db.collection(COLLECTION_NAME).find().toArray();
}

async function findById(id) {
  const db = getDB();
  return await db.collection(COLLECTION_NAME).findOne({ _id: new ObjectId(id) });
}

async function create(data) {
  const db = getDB();
  const result = await db.collection(COLLECTION_NAME).insertOne(data);
  return findById(result.insertedId);
}

async function update(id, data) {
  const db = getDB();
  await db.collection(COLLECTION_NAME).updateOne(
    { _id: new ObjectId(id) },
    { $set: data }
  );
  return findById(id);
}

async function remove(id) {
  const db = getDB();
  await db.collection(COLLECTION_NAME).deleteOne({ _id: new ObjectId(id) });
}

module.exports = {
  findAll,
  findById,
  create,
  update,
  remove
};
`;

  createFile(path.join(moduleDir, `${moduleName}.model.js`), modelContent);

  // Create controller
  const controllerContent = `
const ${moduleName}Model = require('./${moduleName}.model');

async function getAll(req, res, next) {
  try {
    const items = await ${moduleName}Model.findAll();
    res.json(items);
  } catch (error) {
    next(error);
  }
}

async function getById(req, res, next) {
  try {
    const item = await ${moduleName}Model.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: '${moduleName} not found' });
    }
    res.json(item);
  } catch (error) {
    next(error);
  }
}

async function create(req, res, next) {
  try {
    const newItem = await ${moduleName}Model.create(req.body);
    res.status(201).json(newItem);
  } catch (error) {
    next(error);
  }
}

async function update(req, res, next) {
  try {
    const updatedItem = await ${moduleName}Model.update(req.params.id, req.body);
    if (!updatedItem) {
      return res.status(404).json({ message: '${moduleName} not found' });
    }
    res.json(updatedItem);
  } catch (error) {
    next(error);
  }
}

async function remove(req, res, next) {
  try {
    await ${moduleName}Model.remove(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAll,
  getById,
  create,
  update,
  remove
};
`;

  createFile(
    path.join(moduleDir, `${moduleName}.controller.js`),
    controllerContent
  );

  // Create routes
  const routeContent = `
const express = require('express');
const router = express.Router();
const ${moduleName}Controller = require('./${moduleName}.controller');

router.get('/', ${moduleName}Controller.getAll);
router.get('/:id', ${moduleName}Controller.getById);
router.post('/', ${moduleName}Controller.create);
router.patch('/:id', ${moduleName}Controller.update);
router.delete('/:id', ${moduleName}Controller.remove);

module.exports = router;
`;

  createFile(path.join(moduleDir, `${moduleName}.routes.js`), routeContent);

  // Update main index.js to include new routes
  const indexPath = path.join(projectPath, "src", "index.js");
  let indexContent = fs.readFileSync(indexPath, "utf-8");

  // Add route import
  const importStatement = `const ${moduleName}Routes = require('./modules/${moduleName}/${moduleName}.routes');`;
  indexContent = indexContent.replace(
    "// ROUTE_IMPORTS",
    `// ROUTE_IMPORTS\n${importStatement}`
  );

  // Add route middleware
  const middlewareStatement = `app.use('/${moduleName}', ${moduleName}Routes);`;
  indexContent = indexContent.replace(
    "// ROUTE_MIDDLEWARE",
    `// ROUTE_MIDDLEWARE\n${middlewareStatement}`
  );

  fs.writeFileSync(indexPath, indexContent);

  console.log(`
Module "${moduleName}" added successfully!
The following endpoints are now available:

GET    /${moduleName}          - Get all ${moduleName}s
GET    /${moduleName}/:id      - Get one ${moduleName}
POST   /${moduleName}          - Create a new ${moduleName}
PATCH  /${moduleName}/:id      - Update a ${moduleName}
DELETE /${moduleName}/:id      - Delete a ${moduleName}
`);
}
