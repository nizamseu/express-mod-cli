#!/usr/bin/env node

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Get the command and the argument (project or route name)
const args = process.argv.slice(2);
const command = args[0];
const name = args[1];

console.log("command:", command);
console.log("name:", name);

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
  fs.writeFileSync(filePath, content.trim());
};

// Command handling
switch (command) {
  case "create":
    if (!name) {
      console.error(
        "Please provide a project name. Example: npx <your-package-name> create <project-name>"
      );
      process.exit(1);
    }
    createProject(name);
    break;

  case "add":
    if (!name) {
      console.error(
        "Please provide a route name. Example: npx <your-package-name> add <route-name>"
      );
      process.exit(1);
    }
    addModule(name);
    break;

  default:
    console.error(`Unknown command: ${command}. Use "create" or "add".`);
    break;
}

// Function to create a new Express project with modular architecture
function createProject(projectName) {
  const projectPath = path.join(process.cwd(), projectName);

  if (fs.existsSync(projectPath)) {
    console.error(`Directory ${projectName} already exists!`);
    process.exit(1);
  }

  console.log(`Creating a new Express project in ${projectPath}`);
  fs.mkdirSync(projectPath);
  execSync("npm init -y", { cwd: projectPath, stdio: "inherit" });
  execSync("npm install express mongodb dotenv", {
    cwd: projectPath,
    stdio: "inherit",
  });

  // Create basic project structure
  const serverContent = `
  const express = require('express');
  const { MongoClient } = require('mongodb');
  require('dotenv').config();

  const app = express();
  app.use(express.json());

  const PORT = process.env.PORT || 3000;

const usersRoutes = require('./users/users.routes');
app.use('/users', usersRoutes);


const usersRoutes = require('./users/users.routes');
app.use('/users', usersRoutes);

  const uri = process.env.MONGODB_URI;

  MongoClient.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(client => {
      console.log('Connected to MongoDB');
      app.locals.db = client.db('mydatabase'); // Change to your database name

      app.listen(PORT, () => {
        console.log(\`Server running on port \${PORT}\`);
      });
    })
    .catch(err => console.error(err));
  `;
  createFile(path.join(projectPath, "index.js"), serverContent);

  // Create .env file for environment variables
  const envContent = `MONGODB_URI=your_mongodb_connection_string_here`;
  createFile(path.join(projectPath, ".env"), envContent);

  console.log("Express project created successfully!");
}

// Function to add a new module (route) to an existing Express project
function addModule(routeName, projectPath = process.cwd()) {
  console.log(`Adding a new module: ${routeName}`);

  const routeDir = path.join(projectPath, routeName);
  const projectDir = path.basename(projectPath);
  console.log("projectDir", projectDir);

  const moduleDir = path.join(projectPath, projectDir, routeName); // Updated path to be inside the project folder
  // Create the module directory
  fs.mkdirSync(routeDir, { recursive: true });

  // Create model file
  const modelContent = `
  class ${routeName.charAt(0).toUpperCase() + routeName.slice(1)} {
    constructor(db) {
      this.collection = db.collection('${routeName}');
    }

    async findAll() {
      return await this.collection.find().toArray();
    }

    async create(data) {
      const result = await this.collection.insertOne(data);
      return result.ops[0];
    }

    async update(id, data) {
      await this.collection.updateOne({ _id: new require('mongodb').ObjectID(id) }, { $set: data });
      return this.findOne(id);
    }

    async findOne(id) {
      return await this.collection.findOne({ _id: new require('mongodb').ObjectID(id) });
    }

    async delete(id) {
      await this.collection.deleteOne({ _id: new require('mongodb').ObjectID(id) });
    }
  }

  module.exports = ${routeName.charAt(0).toUpperCase() + routeName.slice(1)};
  `;
  createFile(path.join(routeDir, `${routeName}.model.js`), modelContent);

  // Create routes file
  const routeContent = `
  const express = require('express');
  const router = express.Router();
  const ${
    routeName.charAt(0).toUpperCase() + routeName.slice(1)
  } = require('./${routeName}.model');

  router.get('/', async (req, res) => {
    const model = new ${
      routeName.charAt(0).toUpperCase() + routeName.slice(1)
    }(req.app.locals.db);
    const items = await model.findAll();
    res.json(items);
  });

  router.post('/', async (req, res) => {
    const model = new ${
      routeName.charAt(0).toUpperCase() + routeName.slice(1)
    }(req.app.locals.db);
    const newItem = await model.create(req.body);
    res.status(201).json(newItem);
  });

  router.patch('/:id', async (req, res) => {
    const model = new ${
      routeName.charAt(0).toUpperCase() + routeName.slice(1)
    }(req.app.locals.db);
    const updatedItem = await model.update(req.params.id, req.body);
    res.json(updatedItem);
  });

  router.delete('/:id', async (req, res) => {
    const model = new ${
      routeName.charAt(0).toUpperCase() + routeName.slice(1)
    }(req.app.locals.db);
    await model.delete(req.params.id);
    res.status(204).send();
  });

  module.exports = router;
  `;
  createFile(path.join(routeDir, `/${routeName}.routes.js`), routeContent);

  // Update index.js to use the new route
  const indexFilePath = path.join(projectPath, "index.js");
  const importStatement = `const ${routeName}Routes = require('./${routeName}/${routeName}.routes');\n`;
  const useStatement = `app.use('/${routeName}', ${routeName}Routes);\n`;

  // Append to index.js
  let indexContent = fs.readFileSync(indexFilePath, "utf-8");
  indexContent = indexContent.replace(
    /(const PORT = process.env.PORT \|\| 3000;)/,
    `$1\n\n${importStatement}${useStatement}`
  );
  fs.writeFileSync(indexFilePath, indexContent);

  console.log(`${routeName} module added successfully!`);
}
