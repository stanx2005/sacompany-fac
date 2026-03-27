import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema.js';
import * as dotenv from 'dotenv';

dotenv.config();

const client = createClient({
  url: process.env.DB_URL || 'file:local.db',
  authToken: process.env.DB_AUTH_TOKEN || '',
});

export const db = drizzle(client, { schema });
