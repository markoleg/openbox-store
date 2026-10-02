import { NextResponse } from 'next/server';
import { requireOwnerSession } from '@/lib/server/owner';
import { reviewCommandsEnabled } from '@/lib/server/reviewCommands';
import { readBoardVersion } from '@/lib/server/reviewBoards';

/** A few bytes the new queue polls instead of reloading the whole board. */
export async function GET() {
  try { await requireOwnerSession(); } catch { return NextResponse.json({error:'Unauthorized'},{status:401}); }
  if (!reviewCommandsEnabled()) return NextResponse.json({error:'disabled'},{status:503});
  try {
    return NextResponse.json({version:await readBoardVersion()},{headers:{'Cache-Control':'no-store'}});
  } catch { return NextResponse.json({error:'storage_unavailable'},{status:503}); }
}
