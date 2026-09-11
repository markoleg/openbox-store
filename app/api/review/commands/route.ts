import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerSession } from '@/lib/server/owner';
import { hasSameOrigin } from '@/lib/requestOrigin';
import { parseReviewCommand } from '@/lib/reviewCommands';
import { applyReviewCommand, reviewCommandsEnabled, reviewDatabase } from '@/lib/server/reviewCommands';
import { syncEventKeyboards } from '@/lib/server/telegram';

export async function POST(req: NextRequest) {
  try { await requireOwnerSession(); }
  catch { return NextResponse.json({error:'Unauthorized'}, {status:401}); }
  if (!hasSameOrigin(req.headers)) return NextResponse.json({error:'Forbidden'}, {status:403});
  if (!reviewCommandsEnabled()) return NextResponse.json({error:'disabled'}, {status:503});
  let command;
  try {
    const body = await req.text();
    if (body.length > 16384) return NextResponse.json({error:'too_large'}, {status:413});
    command = parseReviewCommand(JSON.parse(body));
  } catch { return NextResponse.json({error:'invalid_command'}, {status:400}); }
  try {
    const result = await applyReviewCommand(command);
    if (result.status === 'applied') {
      // Telegram shows the same projection; a failed edit becomes a durable job,
      // it never rolls the committed decision back.
      const {data} = await reviewDatabase().from('review_command_contexts').select('event_id')
        .eq('id', command.contextId).maybeSingle();
      if (data?.event_id) await syncEventKeyboards(data.event_id).catch(e => console.error('keyboard sync', e instanceof Error ? e.name : e));
    }
    return NextResponse.json(result, {status: result.status === 'conflict' ? 409 : result.status === 'rejected' ? 422 : 200,
      headers:{'Cache-Control':'no-store'}});
  } catch (error) {
    return NextResponse.json({error:'command_failed'},
      {status:error instanceof Error && error.message === 'invalid_review_request' ? 422 : 503});
  }
}
