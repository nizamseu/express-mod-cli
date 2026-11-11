import session, { type SessionOptions, type Store } from 'express-session';
import config, { cookieSecret } from './admin.config';
import databases from '../config/databases';

/**
 * Admin logins are kept in the database that stores the users, using its existing
 * connection. (express-session's default memory store forgets every login on restart
 * and is not meant for production.)
 */
function createStore(maxAgeMs: number): Store {
  if (databases[config.connection].type === 'mongodb') {
    // Loaded only when used: the project may not use this kind of database
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const MongoStore = require('connect-mongo');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getMongoConnection } = require('../config/mongodb');
    const connection = getMongoConnection(config.connection);

    return MongoStore.create({
      client: connection.getClient(),
      dbName: connection.name,
      collectionName: 'admin_sessions',
      ttl: maxAgeMs / 1000,
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const SequelizeStore = require('connect-session-sequelize')(session.Store);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
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
export function sessionOptions(): SessionOptions {
  const maxAge = config.sessionHours * 60 * 60 * 1000;

  return {
    secret: cookieSecret(),
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
