import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerSession } from '@/lib/server/owner';
import { hasSameOrigin } from '@/lib/requestOrigin';
import { reviewCommandsEnabled } from '@/lib/server/reviewCommands';
import { parsePartNumberRequest } from '@/lib/reviewBoards';
import { savePartNumber } from '@/lib/server/reviewBoards';

/** Set or clear the manual part number of a listing. Only the dashboard writes it; Telegram cannot. */
export async function POST(req: NextRequest) {
  let actor;
  try { actor=await requireOwnerSession(); } catch { return NextResponse.json({error:'Unauthorized'},{status:401}); }
  if (!hasSameOrigin(req.headers)) return NextResponse.json({error:'Forbidden'},{status:403});
  if (!reviewCommandsEnabled()) return NextResponse.json({error:'disabled'},{status:503});
  let request;
  try {
    const text=await req.text();
    if (text.length>2048) return NextResponse.json({error:'too_large'},{status:413});
    request=parsePartNumberRequest(JSON.parse(text));
  } catch { return NextResponse.json({error:'invalid_part_number'},{status:400}); }
  try {
    const result=await savePartNumber(request,actor);
    return NextResponse.json(result,{status:result.status==='conflict'?409:result.status==='rejected'?422:200,headers:{'Cache-Control':'no-store'}});
  } catch(error) {
    const invalid=error instanceof Error && error.message==='invalid_part_number';
    return NextResponse.json({error:invalid?'invalid_part_number':'storage_unavailable'},{status:invalid?422:503});
  }
}
