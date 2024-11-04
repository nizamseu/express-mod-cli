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

### Go to Project Directory

```bash
cd projectName
```

### Adding New Modules 📦

```bash
express-mod-cli add users
```

### Example:

`npx express-mod-cli add users`

### Run the Projects

```js
npm run dev
```

### Database Configuration 🔧

#### Local MongoDB Setup

1.  **Update MongoDB URI**
    `env`

- Open the .env file located in the root of the project directory.
- Replace the placeholder MongoDB URI with your actual MongoDB URI.
- Example: `MONGODB_URI=mongodb://localhost:27017/yourDB_name`

### MongoDB Atlas Setup ☁️

If you prefer using MongoDB Atlas (cloud database):

1.  **Get Your Connection String**
    - Log in to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
    - Navigate to your cluster
    - Click "Connect"
    - Choose "Connect your application"
    - Copy the connection string
2.  **Configure Atlas URI**

    env
    ` For MongoDB Atlas MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/yourDB_name DB_NAME=yourDB_name PORT=5000`

    > Remember to replace `<username>`, `<password>`, and the rest of the URI with your actual MongoDB Atlas credentials

## Environment Variables Explained 📝

| Variable      | Description                    | Example                                 |
| ------------- | ------------------------------ | --------------------------------------- |
| `MONGODB_URI` | Your MongoDB connection string | `mongodb://localhost:27017/yourDB_name` |
| `DB_NAME`     | Name of your database          | `yourDB_name`                           |
| `PORTI`       | Port number for the server     | `5000`                                  |

## Modules

Each module follows the Model-Controller-Route pattern and includes:

- Model: Defines the database operations.
- Controller: Manages the business logic for each route.
- Routes: Maps HTTP methods to controller functions.

## Default Endpoints (CRUD)

For each module, the following CRUD endpoints are available:

- GET /module: Retrieve all items.
- GET /module/:id: Retrieve a single item by ID.
- POST /module: Create a new item.
- PATCH /module/:id: Update an existing item by ID.
- DELETE /module/:id: Delete an item by ID

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
