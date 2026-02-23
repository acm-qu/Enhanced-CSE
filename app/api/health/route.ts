import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { getDb } from '@/lib/db/client';
import { getSyncMeta } from '@/lib/db/queries';

const STALE_WINDOW_MS = 16 * 60 * 60 * 1000;

export async function GET(): Promise<NextResponse> {
  let dbOk = false;
  let syncFreshness: 'fresh' | 'stale' | 'never' = 'never';
  let status: 'ok' | 'degraded' | 'down' = 'down';
  let lastSuccessAt: string | null = null;

  try {
    const db = getDb();
    await db.execute(sql`select 1`);
    dbOk = true;

    const meta = await getSyncMeta();
    lastSuccessAt = meta.lastSuccessAt?.toISOString() ?? null;

    if (!meta.lastSuccessAt) {
      syncFreshness = 'never';
      status = 'degraded';
    } else {
      const age = Date.now() - meta.lastSuccessAt.getTime();
      syncFreshness = age > STALE_WINDOW_MS ? 'stale' : 'fresh';
      status = syncFreshness === 'fresh' ? 'ok' : 'degraded';
    }
  } catch {
    dbOk = false;
    syncFreshness = 'never';
    status = 'down';
  }

  return NextResponse.json(
    {
      status,
      db: dbOk ? 'ok' : 'down',
      syncFreshness,
      lastSuccessAt,
      checkedAt: new Date().toISOString()
    },
    {
      status: status === 'down' ? 503 : 200
    }
  );
}
