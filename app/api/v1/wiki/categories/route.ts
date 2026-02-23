import { NextResponse } from 'next/server';

import { listCategories } from '@/lib/db/queries';
import { internalError } from '@/lib/internal/http';

const CACHE_CONTROL = 'public, s-maxage=300, stale-while-revalidate=600';

export async function GET(): Promise<NextResponse> {
  try {
    const categories = await listCategories();
    const response = NextResponse.json({ categories });
    response.headers.set('Cache-Control', CACHE_CONTROL);
    return response;
  } catch {
    return internalError();
  }
}
