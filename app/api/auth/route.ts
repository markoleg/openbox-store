import { NextRequest, NextResponse } from 'next/server';
import { createOwnerSession, ownerPasswordMatches, sessionCookieName, SESSION_SECONDS } from '@/lib/ownerSession';
import { hasSameOrigin } from '@/lib/requestOrigin';

export async function POST(req: NextRequest) {
  if (!hasSameOrigin(req.headers)) {
    return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  }
  let password: unknown;
  try {
    const body = await req.json();
    password = body?.password;
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  if (!await ownerPasswordMatches(password)) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  }
  try {
    const token = await createOwnerSession();
    const response = NextResponse.json({ message: 'Login successful' });
    response.headers.set('Cache-Control', 'no-store');
    response.cookies.set(sessionCookieName(), token, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict', path: '/', maxAge: SESSION_SECONDS,
    });
    return response;
  } catch {
    return NextResponse.json({ error: 'Authentication is not configured' }, { status: 503 });
  }
}
