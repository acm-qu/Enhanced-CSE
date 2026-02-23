import { NextRequest } from 'next/server';

function secureEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return mismatch === 0;
}

export function isSyncRequestAuthorized(request: NextRequest, secret: string): boolean {
  const headerSecret = request.headers.get('x-sync-secret');
  if (!headerSecret) {
    return false;
  }

  return secureEqual(headerSecret, secret);
}

export function isCronRequestAuthorized(request: NextRequest, secret: string): boolean {
  const bearer = request.headers.get('authorization');
  if (bearer?.startsWith('Bearer ')) {
    const token = bearer.slice('Bearer '.length).trim();
    if (token && secureEqual(token, secret)) {
      return true;
    }
  }

  const headerSecret = request.headers.get('x-cron-secret');
  if (headerSecret && secureEqual(headerSecret, secret)) {
    return true;
  }

  const querySecret = request.nextUrl.searchParams.get('secret');
  if (querySecret && secureEqual(querySecret, secret)) {
    return true;
  }

  return false;
}
