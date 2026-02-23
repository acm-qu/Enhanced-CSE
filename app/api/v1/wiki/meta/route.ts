import { NextResponse } from 'next/server';

import { getSyncMeta } from '@/lib/db/queries';
import { internalError } from '@/lib/internal/http';

const CACHE_CONTROL = 'public, s-maxage=30, stale-while-revalidate=120';

export async function GET(): Promise<NextResponse> {
  try {
    const meta = await getSyncMeta();
    const response = NextResponse.json({
      hasTags: meta.hasTags,
      lastSuccessAt: meta.lastSuccessAt?.toISOString() ?? null,
      lastRunStatus: meta.lastRunStatus
    });

    response.headers.set('Cache-Control', CACHE_CONTROL);
    return response;
  } catch {
    return internalError();
  }
}
