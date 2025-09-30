const messages = {
  error: {
    noCommand: 'Please provide a command (e.g., create or add).',
    noProjectName: 'Please provide a project name.',
    noModuleName: 'Please provide a module name.',
    unknownCommand: (cmd) => `Unknown command: ${cmd}. Use "create" or "add".`,
    directoryExists: (name) => `Directory ${name} already exists!`,
    notInProject: 'Please run this command from the root of your Express project.',
    mongoConnection: 'MongoDB connection error:',
    serverStart: 'Failed to start server:'
  },
  
  success: {
    projectCreated: (name) => `Express project "${name}" created successfully!`,
    moduleAdded: (name) => `Module "${name}" added successfully!`,
    connected: 'Connected to MongoDB',
    serverRunning: (port) => `Server running on port ${port}`
  },
  
  info: {
    creating: (path) => `Creating a new Express project in ${path}`,
    installing: 'Installing dependencies...',
    adding: (name) => `Adding new module: ${name}`,
    command: (cmd) => `Command: ${cmd}`,
    name: (name) => `Name: ${name}`
  },
  
  instructions: {
    getStarted: (projectName) => `
Express project "${projectName}" created successfully!

To get started:
  cd ${projectName}
  npm run dev
  
Configuration Steps:
1. Update MongoDB URI in .env file:
   - MONGODB_URI=mongodb://localhost:27017
   - DB_NAME=${projectName}_db

2. Your project uses Mongoose for MongoDB ODM with:
   - Schema validation
   - Clean MVC architecture  
   - Automatic timestamps

To add new modules:
  npx express-mod-cli add <module-name>
    `,
    
    moduleEndpoints: (moduleName) => `
Module "${moduleName}" added successfully!

Available API Endpoints:
GET    /${moduleName}          - Get all ${moduleName}s
GET    /${moduleName}/:id      - Get one ${moduleName}
POST   /${moduleName}          - Create a new ${moduleName}
PATCH  /${moduleName}/:id      - Update a ${moduleName}
DELETE /${moduleName}/:id      - Delete a ${moduleName}

Generated Files:
- ${moduleName}.model.js      - Mongoose schema and model
- ${moduleName}.controller.js - Business logic handlers
- ${moduleName}.routes.js     - Express routes
`
  }
};

module.exports = messages;