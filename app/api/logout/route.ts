import { NextRequest, NextResponse } from 'next/server';
import { sessionCookieName } from '@/lib/ownerSession';
import { hasSameOrigin } from '@/lib/requestOrigin';

export async function POST(req: NextRequest) {
  if (!hasSameOrigin(req.headers)) {
    return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  }
  const response = NextResponse.json({ ok: true });
  response.headers.set('Cache-Control', 'no-store');
  response.cookies.set(sessionCookieName(), '', {
    httpOnly: true, secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict', path: '/', maxAge: 0,
  });
  return response;
}
