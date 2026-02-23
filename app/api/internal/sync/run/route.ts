import { NextRequest, NextResponse } from 'next/server';

import { isSyncRequestAuthorized } from '@/lib/internal/auth';
import { getSyncSecret } from '@/lib/internal/env';
import { internalError, unauthorized } from '@/lib/internal/http';
import { runFullSync } from '@/lib/sync/service';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const secret = getSyncSecret();
    if (!isSyncRequestAuthorized(request, secret)) {
      return unauthorized();
    }

    const result = await runFullSync('manual');
    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'no-store'
      }
    });
  } catch {
    return internalError();
  }
}
