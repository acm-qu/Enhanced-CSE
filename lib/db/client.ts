import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from '@/lib/db/schema';

type DbClient = ReturnType<typeof drizzle<typeof schema>>;

declare global {
  var __wikiSqlClient: ReturnType<typeof postgres> | undefined;
  var __wikiDbClient: DbClient | undefined;
}

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is required');
  }
  return url;
}

export function getDb(): DbClient {
  if (!global.__wikiSqlClient) {
    global.__wikiSqlClient = postgres(getDatabaseUrl(), {
      max: 10,
      prepare: false,
      idle_timeout: 20,
      connect_timeout: 10
    });
  }

  if (!global.__wikiDbClient) {
    global.__wikiDbClient = drizzle(global.__wikiSqlClient, { schema });
  }

  return global.__wikiDbClient;
}

export async function closeDbConnection(): Promise<void> {
  if (global.__wikiSqlClient) {
    await global.__wikiSqlClient.end({ timeout: 5 });
    global.__wikiSqlClient = undefined;
    global.__wikiDbClient = undefined;
  }
}
