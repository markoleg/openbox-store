import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerSession } from '@/lib/server/owner';
import { hasSameOrigin } from '@/lib/requestOrigin';
import { reviewCommandsEnabled } from '@/lib/server/reviewCommands';
import { parseAssessment } from '@/lib/reviewBoards';
import { saveAssessment } from '@/lib/server/reviewBoards';

export async function POST(req: NextRequest) {
  try { await requireOwnerSession(); } catch { return NextResponse.json({error:'Unauthorized'},{status:401}); }
  if (!hasSameOrigin(req.headers)) return NextResponse.json({error:'Forbidden'},{status:403});
  if (!reviewCommandsEnabled()) return NextResponse.json({error:'disabled'},{status:503});
  let request;
  try {
    const text=await req.text();
    if (text.length>98304) return NextResponse.json({error:'too_large'},{status:413});
    request=parseAssessment(JSON.parse(text));
  } catch { return NextResponse.json({error:'invalid_assessment'},{status:400}); }
  try {
    const result=await saveAssessment(request);
    return NextResponse.json(result,{status:result.status==='conflict'?409:result.status==='rejected'?422:200,headers:{'Cache-Control':'no-store'}});
  } catch(error) {
    const invalid=error instanceof Error && error.message==='invalid_assessment';
    return NextResponse.json({error:invalid?'incomplete_or_invalid_assessment':'storage_unavailable'},{status:invalid?422:503});
  }
}
