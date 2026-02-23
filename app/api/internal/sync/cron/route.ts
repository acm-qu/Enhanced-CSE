import { NextRequest, NextResponse } from 'next/server';

import { isCronRequestAuthorized } from '@/lib/internal/auth';
import { getCronSecret } from '@/lib/internal/env';
import { internalError, unauthorized } from '@/lib/internal/http';
import { runFullSync } from '@/lib/sync/service';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const cronSecret = getCronSecret();
    if (!isCronRequestAuthorized(request, cronSecret)) {
      return unauthorized();
    }

    const result = await runFullSync('cron');
    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'no-store'
      }
    });
  } catch {
    return internalError();
  }
}
