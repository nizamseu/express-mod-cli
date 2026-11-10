import mongoose, { type Connection } from 'mongoose';
import databases from './databases';

const connections: Record<string, Connection> = {};

/**
 * Get the Mongoose connection for a database defined in ./databases.ts
 *
 * The connection object is created on first use and opened by connectAll().
 * Until then queries are buffered, so models can be defined (and the app
 * imported in tests) without a running database.
 */
export function getMongoConnection(name = 'default'): Connection {
  const existing = connections[name];
  if (existing) return existing;

  const config = databases[name];
  if (!config || config.type !== 'mongodb') {
    throw new Error(`MongoDB connection "${name}" is not defined in src/config/databases.ts`);
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

/** Open every MongoDB connection listed in ./databases.ts */
export async function connectAll(): Promise<void> {
  const names = Object.keys(databases).filter((name) => databases[name]?.type === 'mongodb');

  await Promise.all(
    names.map(async (name) => {
      const config = databases[name];
      if (!config) return;

      await getMongoConnection(name).openUri(config.uri, { dbName: config.dbName });
      console.log(`Connected to MongoDB "${name}"`);
    })
  );
}

/** Close every MongoDB connection */
export async function disconnectAll(): Promise<void> {
  await Promise.all(Object.values(connections).map((connection) => connection.close()));
}
