const express = require("express");
const { connectDB } = require("./config/db");
const cors = require("cors");
const helmet = require("helmet");

// Import middleware
const errorHandler = require("./middleware/errorHandler");

const app = express();

// Middleware
app.use(express.json());
app.use(cors());
app.use(helmet());

// Route imports will be automatically added here
// ROUTE_IMPORTS
const productsRoutes = require("./modules/products/products.routes");
const usersRoutes = require("./modules/users/users.routes");

// Route middleware will be automatically added here
// ROUTE_MIDDLEWARE
app.use("/products", productsRoutes);
app.use("/users", usersRoutes);

// Error handling middleware
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

startServer();
