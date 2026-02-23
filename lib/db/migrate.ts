import { migrate } from 'drizzle-orm/postgres-js/migrator';

import { getDb } from '@/lib/db/client';

export async function runMigrations(): Promise<void> {
  const db = getDb();
  await migrate(db, {
    migrationsFolder: 'drizzle'
  });
}
