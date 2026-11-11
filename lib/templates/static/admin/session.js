const session = require('express-session');
const config = require('./admin.config');
const databases = require('../config/databases');

/**
 * Admin logins are kept in the database that stores the users, using its existing
 * connection. (express-session's default memory store forgets every login on restart
 * and is not meant for production.)
 */
function createStore(maxAgeMs) {
  if (databases[config.connection].type === 'mongodb') {
    const MongoStore = require('connect-mongo');
    const { getMongoConnection } = require('../config/mongodb');
    const connection = getMongoConnection(config.connection);

    return MongoStore.create({
      client: connection.getClient(),
      dbName: connection.name,
      collectionName: 'admin_sessions',
      ttl: maxAgeMs / 1000,
    });
  }

  const SequelizeStore = require('connect-session-sequelize')(session.Store);
  const { getSqlConnection } = require('../config/sql');

  // The admin_sessions table is created by a migration
  return new SequelizeStore({
    db: getSqlConnection(config.connection),
    tableName: 'admin_sessions',
    expiration: maxAgeMs,
    checkExpirationInterval: 15 * 60 * 1000,
  });
}

/** Options for the admin panel's express-session */
function sessionOptions() {
  const maxAge = config.sessionHours * 60 * 60 * 1000;

  return {
    secret: config.cookieSecret(),
    store: createStore(maxAge),
    resave: false,
    saveUninitialized: false,
    // Behind a reverse proxy that terminates HTTPS, also call app.set('trust proxy', 1) in src/app
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge,
    },
  };
}

module.exports = { sessionOptions };
