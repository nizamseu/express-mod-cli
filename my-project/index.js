const express = require('express');
const { MongoClient } = require('mongodb');
require('dotenv').config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Route imports will be automatically added here
// ROUTE_IMPORTS
const usersRoutes = require('./users/users.routes');

// Route middleware will be automatically added here
// ROUTE_MIDDLEWARE
app.use('/users', usersRoutes);

const uri = process.env.MONGODB_URI;

async function startServer() {
  try {
    const client = await MongoClient.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('Connected to MongoDB');
    app.locals.db = client.db(process.env.DB_NAME);

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1);
  }
}

startServer();
