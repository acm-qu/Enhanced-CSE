import { NextResponse } from 'next/server';

import { listTags } from '@/lib/db/queries';
import { internalError } from '@/lib/internal/http';

const CACHE_CONTROL = 'public, s-maxage=300, stale-while-revalidate=600';

export async function GET(): Promise<NextResponse> {
  try {
    const tags = await listTags();
    const response = NextResponse.json({ tags });
    response.headers.set('Cache-Control', CACHE_CONTROL);
    return response;
  } catch {
    return internalError();
  }
}
