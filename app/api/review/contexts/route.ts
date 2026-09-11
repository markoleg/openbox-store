import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerSession } from '@/lib/server/owner';
import { hasSameOrigin } from '@/lib/requestOrigin';
import { parseReviewContext } from '@/lib/reviewCommands';
import { issueReviewContext } from '@/lib/server/reviewCommands';

export async function POST(req: NextRequest) {
  try { await requireOwnerSession(); }
  catch { return NextResponse.json({error:'Unauthorized'}, {status:401}); }
  if (!hasSameOrigin(req.headers)) return NextResponse.json({error:'Forbidden'}, {status:403});
  if (process.env.REVIEW_COMMANDS_ENABLED !== 'true') return NextResponse.json({error:'disabled'}, {status:503});
  let context;
  try {
    const body = await req.text();
    if (body.length > 8192) return NextResponse.json({error:'too_large'}, {status:413});
    context = parseReviewContext(JSON.parse(body));
  } catch { return NextResponse.json({error:'invalid_context'}, {status:400}); }
  try {
    return NextResponse.json(await issueReviewContext(context.kind, context.target),
      {headers:{'Cache-Control':'no-store'}});
  } catch (error) {
    return NextResponse.json({error:'context_unavailable'},
      {status:error instanceof Error && error.message === 'invalid_review_request' ? 422 : 503});
  }
}
