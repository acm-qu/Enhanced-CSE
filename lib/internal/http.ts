import { NextResponse } from 'next/server';

export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function unauthorized(message = 'Unauthorized'): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function notFound(message = 'Not found'): NextResponse {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function internalError(message = 'Internal server error'): NextResponse {
  return NextResponse.json({ error: message }, { status: 500 });
}

export function jsonCached(data: unknown, cacheControl: string): NextResponse {
  const response = NextResponse.json(data);
  response.headers.set('Cache-Control', cacheControl);
  return response;
}
