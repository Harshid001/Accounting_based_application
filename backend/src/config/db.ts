import type { Db } from 'mongodb';
import mongoose from 'mongoose';

import { env, isProduction } from './env.js';
import { logger } from './logger.js';

mongoose.set('strictQuery', true);
mongoose.set('autoIndex', !isProduction);

let connected = false;

export const connectDatabase = async (uri: string = env.MONGODB_URI): Promise<void> => {
  if (connected) return;
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10_000,
    maxPoolSize: 20,
    autoIndex: !isProduction,
  });
  connected = true;
  logger.info({ event: 'db.connected' }, 'database connection established');
};

export const disconnectDatabase = async (): Promise<void> => {
  if (!connected) return;
  await mongoose.disconnect();
  connected = false;
  logger.info({ event: 'db.disconnected' }, 'database connection closed');
};

export const getDb = (): Db => {
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Database is not connected. Call connectDatabase() before getDb().');
  }
  return db;
};

export const databaseState = (): 'up' | 'down' =>
  Number(mongoose.connection.readyState) === 1 ? 'up' : 'down';

export { mongoose };
