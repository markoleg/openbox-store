import {NextRequest,NextResponse} from 'next/server';
import {requireOwnerSession} from '@/lib/server/owner';
import {hasSameOrigin} from '@/lib/requestOrigin';
import {isUuid} from '@/lib/reviewCommands';
import {reviewCommandsEnabled,reviewDatabase} from '@/lib/server/reviewCommands';
import {syncEventKeyboards} from '@/lib/server/telegram';

export async function POST(req:NextRequest){
  try{await requireOwnerSession()}catch{return NextResponse.json({error:'Unauthorized'},{status:401})}
  if(!hasSameOrigin(req.headers))return NextResponse.json({error:'Forbidden'},{status:403});
  if(!reviewCommandsEnabled())return NextResponse.json({error:'disabled'},{status:503});
  let body;
  try{const text=await req.text();if(text.length>4096)throw new Error();body=JSON.parse(text);
    if(!body || Object.keys(body).some(k=>!['commandId','contextId','key','version','assign'].includes(k)) ||
      !isUuid(body.commandId) || !isUuid(body.contextId) || typeof body.key!=='string' || !body.key || body.key.length>500 ||
      !Number.isSafeInteger(body.version) || body.version<1 || typeof body.assign!=='boolean')throw new Error();
  }catch{return NextResponse.json({error:'invalid_assignment'},{status:400})}
  const db=reviewDatabase();
  const {data,error}=await db.rpc('assign_notification_purchase',{p_command:body.commandId,p_context:body.contextId,p_key:body.key,p_version:body.version,p_assign:body.assign});
  if(error)return NextResponse.json({error:'assignment_failed'},{status:503});
  if(data.status==='applied'){
    const {data:context}=await db.from('review_command_contexts').select('event_id').eq('id',body.contextId).maybeSingle();
    if(context?.event_id)await syncEventKeyboards(context.event_id).catch(()=>{});
  }
  return NextResponse.json(data,{status:data.status==='conflict'?409:data.status==='rejected'?422:200,headers:{'Cache-Control':'no-store'}});
}
