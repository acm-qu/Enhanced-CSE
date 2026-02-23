import { NextRequest, NextResponse } from 'next/server';

import { getSyncStatus } from '@/lib/db/queries';
import { isSyncRequestAuthorized } from '@/lib/internal/auth';
import { getSyncSecret } from '@/lib/internal/env';
import { internalError, unauthorized } from '@/lib/internal/http';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const secret = getSyncSecret();
    if (!isSyncRequestAuthorized(request, secret)) {
      return unauthorized();
    }

    const status = await getSyncStatus();
    return NextResponse.json(status, {
      headers: {
        'Cache-Control': 'no-store'
      }
    });
  } catch {
    return internalError();
  }
}
