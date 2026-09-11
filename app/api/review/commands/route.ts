import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerSession } from '@/lib/server/owner';
import { hasSameOrigin } from '@/lib/requestOrigin';
import { parseReviewCommand } from '@/lib/reviewCommands';
import { applyReviewCommand } from '@/lib/server/reviewCommands';

export async function POST(req: NextRequest) {
  try { await requireOwnerSession(); }
  catch { return NextResponse.json({error:'Unauthorized'}, {status:401}); }
  if (!hasSameOrigin(req.headers)) return NextResponse.json({error:'Forbidden'}, {status:403});
  if (process.env.REVIEW_COMMANDS_ENABLED !== 'true') return NextResponse.json({error:'disabled'}, {status:503});
  let command;
  try {
    const body = await req.text();
    if (body.length > 16384) return NextResponse.json({error:'too_large'}, {status:413});
    command = parseReviewCommand(JSON.parse(body));
  } catch { return NextResponse.json({error:'invalid_command'}, {status:400}); }
  try {
    const result = await applyReviewCommand(command);
    return NextResponse.json(result, {status: result.status === 'conflict' ? 409 : result.status === 'rejected' ? 422 : 200,
      headers:{'Cache-Control':'no-store'}});
  } catch (error) {
    return NextResponse.json({error:'command_failed'},
      {status:error instanceof Error && error.message === 'invalid_review_request' ? 422 : 503});
  }
}
