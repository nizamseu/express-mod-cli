# Express Modular Generator

A command-line tool to generate Express.js applications with a modular architecture pattern.

## Installation

```bash
npm install -g express-mod-cli
```

## Usage

### Create a new project

```bash
express-mod-cli create my-project
```

### Add a new module

```bash
express-mod-cli add users
```

```
To get started:
      cd projectName
      npm run dev

    1. Update MongoDB URI:
       - Open the .env file located in the root of the project directory.
       - Replace the placeholder MongoDB URI with your actual MongoDB URI.
       - Example:
         MONGODB_URI=mongodb://localhost:27017/yourDB_name

    2. Add your database name:
       - You can specify the database name directly in the MongoDB URI as shown above,
         or set it as a separate environment variable:
         DB_NAME=yourDB_name

    3. Example .env file setup:
       - MONGODB_URI=mongodb://localhost:27017/yourDB_name
       - DB_NAME=yourDB_name
       - PORT=5000

    4. Save the .env file and restart the server to apply changes.

    To add new modules:
      npx express-mod-cli add <module-name>
```

## Features

- Modular architecture with Model-Route-Controller pattern
- MongoDB integration
- Error handling middleware
- CORS and security headers
- Environment configuration
- Ready-to-use CRUD operations

## Upcoming Features

- Authentication: Adding user authentication with JWT for securing endpoints.
- Route Authentication: Implementing route-level authentication middleware to restrict access to specific routes.

## Project Structure

```
project/
├── src/
│   ├── config/
│   │   └── db.js
│   ├── middleware/
│   │   └── errorHandler.js
│   ├── modules/
│   │   └── [module-name]/
│   │       ├── module.model.js
│   │       ├── module.controller.js
│   │       └── module.routes.js
│   ├── utils/
│   └── index.js
├── .env
├── .gitignore
└── package.json
```

## License

MIT
