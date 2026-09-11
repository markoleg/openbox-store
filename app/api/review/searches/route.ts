import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerSession } from '@/lib/server/owner';
import { hasSameOrigin } from '@/lib/requestOrigin';
import { parseSearchSave } from '@/lib/reviewCommands';
import { reviewCommandsEnabled, saveSearchConfiguration } from '@/lib/server/reviewCommands';

/** Search configuration save: whole-config audit plus explicit ban/unban deltas. */
export async function POST(req: NextRequest) {
  try { await requireOwnerSession(); }
  catch { return NextResponse.json({error:'Unauthorized'}, {status:401}); }
  if (!hasSameOrigin(req.headers)) return NextResponse.json({error:'Forbidden'}, {status:403});
  if (!reviewCommandsEnabled()) return NextResponse.json({error:'disabled'}, {status:503});
  let request;
  try {
    const body = await req.text();
    if (body.length > 65536) return NextResponse.json({error:'too_large'}, {status:413});
    request = parseSearchSave(JSON.parse(body));
  } catch { return NextResponse.json({error:'invalid_search_save'}, {status:400}); }
  try {
    const result = await saveSearchConfiguration(request);
    return NextResponse.json(result, {status: result.status === 'conflict' ? 409 : result.status === 'rejected' ? 422 : 200,
      headers:{'Cache-Control':'no-store'}});
  } catch (error) {
    return NextResponse.json({error:'save_failed'},
      {status:error instanceof Error && error.message === 'invalid_review_request' ? 422 : 503});
  }
}
