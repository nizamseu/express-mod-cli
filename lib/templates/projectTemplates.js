/**
 * Generate package.json content for new projects
 * @param {string} projectName - The name of the project
 * @returns {object} - Package.json object
 */
const generatePackageJson = (projectName) => {
  return {
    name: projectName,
    version: "1.0.0",
    description: "Express application with MVC architecture",
    main: "src/index.js",
    scripts: {
      start: "node src/index.js",
      dev: "nodemon src/index.js",
    },
    dependencies: {
      express: "^5.1.0",
      mongoose: "^8.7.0",
      dotenv: "^17.2.3",
      cors: "^2.8.5",
      helmet: "^8.1.0",
    },
    devDependencies: {
      nodemon: "^3.1.10",
    },
  };
};

/**
 * Generate main server file content
 * @returns {string} - Server file content
 */
const generateServerContent = () => {
  return `
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
};

/**
 * Generate database configuration content
 * @returns {string} - Database config content
 */
const generateDbConfig = () => {
  return `
const mongoose = require('mongoose');
require('dotenv').config();

async function connectDB() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
    const dbName = process.env.DB_NAME || 'express_app';
    
    await mongoose.connect(\`\${mongoUri}/\${dbName}\`);
    
    console.log('Connected to MongoDB with Mongoose');
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected');
    });
    
  } catch (err) {
    console.error('MongoDB connection error:', err);
    throw err;
  }
}

async function disconnectDB() {
  try {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (err) {
    console.error('Error disconnecting from MongoDB:', err);
  }
}

module.exports = { connectDB, disconnectDB };
`;
};

/**
 * Generate error handler middleware content
 * @returns {string} - Error handler content
 */
const generateErrorHandler = () => {
  return `
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
};

/**
 * Generate .env file content
 * @param {string} projectName - The project name
 * @returns {string} - Environment file content
 */
const generateEnvFile = (projectName) => {
  return `
# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017
DB_NAME=${projectName}_db

# Server Configuration
PORT=5000
NODE_ENV=development

# JWT Configuration (optional)
JWT_SECRET=your_jwt_secret_here

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
  generatePackageJson,
  generateServerContent,
  generateDbConfig,
  generateErrorHandler,
  generateEnvFile,
  generateGitignore,
};
