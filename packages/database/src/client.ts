import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.ts';
import { env } from './env.ts';

const queryClient = postgres(env.DATABASE_URL, {
  max: env.NODE_ENV === 'production' ? 20 : 5,
  prepare: false,
});

export const db = drizzle(queryClient, { schema, casing: 'snake_case' });
export type Database = typeof db;
