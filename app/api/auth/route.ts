import { NextRequest, NextResponse } from 'next/server';
import { serialize } from 'cookie';

export async function POST(req: NextRequest) {
  const reqBody = await req.json();
  const { password } = reqBody;

  if (password === process.env.PASSWORD) {
    const twoWeeks = 14 * 24 * 60 * 60 * 1000;
    const expires = new Date(Date.now() + twoWeeks);

    const cookie = serialize(process.env.PASSWORD_COOKIE_NAME!, 'true', {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      expires: expires,
    });

    const response = new NextResponse(JSON.stringify({ message: 'Login successful' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Set-Cookie': cookie },
    });

    return response;
  } else {
    return new NextResponse(JSON.stringify({ error: 'Invalid password' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
