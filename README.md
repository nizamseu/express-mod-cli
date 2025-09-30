# Express Modular Generator

A modern command-line tool to generate Express.js applications with clean MVC architecture and Mongoose ODM integration.

## ✨ Features

- 🏗️ **Modular MVC Architecture** - Clean separation of concerns
- 🍃 **Mongoose Integration** - Modern MongoDB ODM with schema validation
- 🚀 **Latest Dependencies** - Express 5.x, Mongoose 8.x, and more
- 🔒 **Security Ready** - CORS, Helmet, and error handling built-in
- ⚡ **Zero Configuration** - Ready to run with minimal setup
- 📦 **Modular Design** - Easy to add and manage modules

## 📋 Installation

```bash
npm install -g express-mod-cli
```

## 🚀 Quick Start

### Create a new project

```bash
express-mod-cli create my-project
cd my-project
npm run dev
```

### Add modules to your project

```bash
express-mod-cli add users
express-mod-cli add products
express-mod-cli add orders
```

## 📖 Commands

| Command                 | Description                         | Example                         |
| ----------------------- | ----------------------------------- | ------------------------------- |
| `create <project-name>` | Create a new Express project        | `express-mod-cli create my-app` |
| `add <module-name>`     | Add a new module to current project | `express-mod-cli add users`     |
| `--help` or `-h`        | Show help information               | `express-mod-cli --help`        |
| `--version` or `-v`     | Show version number                 | `express-mod-cli --version`     |

## 🗄️ Database Configuration

### MongoDB with Mongoose

Your generated project uses **Mongoose** for elegant MongoDB object modeling. The configuration is already set up in `src/config/db.js`.

#### Local MongoDB Setup

1. **Install MongoDB locally** or use Docker:

   ```bash
   # Using Docker
   docker run -d -p 27017:27017 --name mongodb mongo:latest
   ```

2. **Update your .env file:**
   ```env
   MONGODB_URI=mongodb://localhost:27017
   DB_NAME=your_project_name_db
   PORT=5000
   NODE_ENV=development
   ```

#### MongoDB Atlas Setup (Cloud)

1. **Create a MongoDB Atlas account** at [mongodb.com/atlas](https://www.mongodb.com/cloud/atlas)
2. **Get your connection string** from Atlas dashboard
3. **Update your .env file:**
   ```env
   MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net
   DB_NAME=your_project_name_db
   PORT=5000
   NODE_ENV=production
   ```

## 🏗️ Generated Project Structure

Each generated project follows this clean structure:

```
my-project/
├── src/
│   ├── config/
│   │   └── db.js                 # Mongoose connection setup
│   ├── middleware/
│   │   └── errorHandler.js       # Global error handling
│   ├── modules/                  # Your business modules
│   │   └── [module-name]/
│   │       ├── module.model.js   # Mongoose schema & model
│   │       ├── module.controller.js # Business logic
│   │       └── module.routes.js  # Express routes
│   ├── utils/                    # Utility functions
│   └── index.js                  # Main server file
├── .env                          # Environment variables
├── .gitignore                    # Git ignore rules
└── package.json                  # Dependencies & scripts
```

## 📦 Module Architecture

Each module generates exactly **3 files** following MVC pattern:

### 🔹 Model (`{module}.model.js`)

```javascript
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
```

### 🔹 Controller (`{module}.controller.js`)

```javascript
const User = require("./user.model");

async function getAll(req, res, next) {
  try {
    const items = await User.find().sort({ createdAt: -1 });
    res.json({
      success: true,
      data: items,
      message: "Users retrieved successfully",
    });
  } catch (error) {
    next(error);
  }
}
// ... other CRUD methods
```

### 🔹 Routes (`{module}.routes.js`)

```javascript
const express = require("express");
const router = express.Router();
const userController = require("./user.controller");

router.get("/", userController.getAll);
router.get("/:id", userController.getById);
router.post("/", userController.create);
router.patch("/:id", userController.update);
router.delete("/:id", userController.remove);

module.exports = router;
```

## 🔗 API Endpoints

Each generated module provides RESTful API endpoints:

| Method   | Endpoint        | Description     | Response                                         |
| -------- | --------------- | --------------- | ------------------------------------------------ |
| `GET`    | `/{module}`     | Get all items   | `{ success: true, data: [...], message: "..." }` |
| `GET`    | `/{module}/:id` | Get one item    | `{ success: true, data: {...}, message: "..." }` |
| `POST`   | `/{module}`     | Create new item | `{ success: true, data: {...}, message: "..." }` |
| `PATCH`  | `/{module}/:id` | Update item     | `{ success: true, data: {...}, message: "..." }` |
| `DELETE` | `/{module}/:id` | Delete item     | `{ success: true, data: {...}, message: "..." }` |

### 🔍 Example API Usage

```bash
# Get all users
curl http://localhost:5000/users

# Get specific user
curl http://localhost:5000/users/60d5ec49f1b2c8b1f8e4e1a1

# Create new user
curl -X POST http://localhost:5000/users \
  -H "Content-Type: application/json" \
  -d '{"name": "John Doe", "description": "Software Developer"}'

# Update user
curl -X PATCH http://localhost:5000/users/60d5ec49f1b2c8b1f8e4e1a1 \
  -H "Content-Type: application/json" \
  -d '{"status": "inactive"}'
```

## 🛠️ Technology Stack

### Core Dependencies

- **Express.js 5.x** - Fast, unopinionated web framework
- **Mongoose 8.x** - Elegant MongoDB object modeling
- **dotenv 17.x** - Environment variable management
- **CORS 2.x** - Cross-origin resource sharing
- **Helmet 8.x** - Security middleware

### Development Dependencies

- **Nodemon 3.x** - Development server with auto-restart

## 🏃‍♂️ Development Workflow

1. **Create Project:**

   ```bash
   express-mod-cli create my-ecommerce-app
   cd my-ecommerce-app
   ```

2. **Configure Database:**

   ```bash
   # Edit .env file
   MONGODB_URI=mongodb://localhost:27017
   DB_NAME=ecommerce_db
   ```

3. **Add Business Modules:**

   ```bash
   express-mod-cli add products
   express-mod-cli add categories
   express-mod-cli add orders
   express-mod-cli add customers
   ```

4. **Start Development:**
   ```bash
   npm run dev
   ```

## 🎯 Best Practices

### Model Customization

After generating a module, customize the Mongoose schema:

```javascript
// Example: Enhanced User model
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true, minlength: 6 },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    profile: {
      avatar: String,
      bio: String,
      phone: String,
    },
  },
  { timestamps: true }
);
```

### Controller Enhancement

Add business logic to controllers:

```javascript
// Add custom methods
async function getUserByEmail(req, res, next) {
  try {
    const user = await User.findOne({ email: req.params.email });
    // ... handle response
  } catch (error) {
    next(error);
  }
}
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 Changelog

### v1.1.0 (Latest)

- 🆕 **Mongoose Integration** - Replaced native MongoDB driver with Mongoose ODM
- 🔄 **Modular CLI Architecture** - Refactored CLI into clean, maintainable modules
- ⬆️ **Updated Dependencies** - Latest versions (Express 5.x, Mongoose 8.x)
- 🐛 **Bug Fixes** - Resolved template generation issues
- 📚 **Enhanced Documentation** - Complete API reference and examples
- 🔒 **Security Improvements** - Zero vulnerabilities in generated projects

### v1.0.11 (Previous)

- Basic project and module generation
- Native MongoDB driver integration
- Simple MVC structure

## 📞 Support

- 🐛 **Issues**: [GitHub Issues](https://github.com/nizamseu/express-mod-cli/issues)
- 📖 **Documentation**: This README
- 💬 **Discussions**: [GitHub Discussions](https://github.com/nizamseu/express-mod-cli/discussions)

## 📜 License

MIT © [Nizam Uddin](https://github.com/nizamseu)

---

**Made with ❤️ for the Express.js community**
