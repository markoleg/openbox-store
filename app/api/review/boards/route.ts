import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerSession } from '@/lib/server/owner';
import { reviewCommandsEnabled } from '@/lib/server/reviewCommands';
import { parseBoardQuery } from '@/lib/reviewBoards';
import { readBoard, readCard } from '@/lib/server/reviewBoards';
import { isUuid } from '@/lib/reviewCommands';

export async function GET(req: NextRequest) {
  try { await requireOwnerSession(); } catch { return NextResponse.json({error:'Unauthorized'},{status:401}); }
  if (!reviewCommandsEnabled()) return NextResponse.json({error:'disabled'},{status:503});
  let query;
  try { query=parseBoardQuery(req.nextUrl.searchParams); }
  catch { return NextResponse.json({error:'invalid_filters'},{status:400}); }
  const id=req.nextUrl.searchParams.get('id');
  if (id && !isUuid(id)) return NextResponse.json({error:'invalid_id'},{status:400});
  try {
    const data=id ? await readCard(query.board,id) : await readBoard(query.board,query.filters,query.cursors);
    return NextResponse.json(data,{status:data ? 200 : 404,headers:{'Cache-Control':'no-store'}});
  } catch { return NextResponse.json({error:'storage_unavailable'},{status:503}); }
}
