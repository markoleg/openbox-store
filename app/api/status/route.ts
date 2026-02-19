import { NextResponse } from 'next/server';

const STATUS_URL = 'https://zhezhemon.fly.dev/status';

export async function GET() {
  try {
    const res = await fetch(STATUS_URL);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Failed to fetch' },
      { status: 500 }
    );
  }
}
