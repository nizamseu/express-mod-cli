const mongoose = require('mongoose');
const databases = require('./databases');

const connections = {};

/**
 * Get the Mongoose connection for a database defined in ./databases.js
 *
 * The connection object is created on first use and opened by connectAll().
 * Until then queries are buffered, so models can be defined (and the app
 * imported in tests) without a running database.
 */
function getMongoConnection(name = 'default') {
  if (connections[name]) return connections[name];

  const config = databases[name];
  if (!config || config.type !== 'mongodb') {
    throw new Error(`MongoDB connection "${name}" is not defined in src/config/databases.js`);
  }

  const connection = mongoose.createConnection();

  connection.on('error', (err) => {
    console.error(`MongoDB "${name}" connection error:`, err);
  });
  connection.on('disconnected', () => {
    console.log(`MongoDB "${name}" disconnected`);
  });

  connections[name] = connection;
  return connection;
}

/** Open every MongoDB connection listed in ./databases.js */
async function connectAll() {
  const names = Object.keys(databases).filter((name) => databases[name].type === 'mongodb');

  await Promise.all(
    names.map(async (name) => {
      const { uri, dbName } = databases[name];
      await getMongoConnection(name).openUri(uri, { dbName });
      console.log(`Connected to MongoDB "${name}"`);
    })
  );
}

/** Close every MongoDB connection */
async function disconnectAll() {
  await Promise.all(Object.values(connections).map((connection) => connection.close()));
}

module.exports = { getMongoConnection, connectAll, disconnectAll };
