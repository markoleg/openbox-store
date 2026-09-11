import {NextRequest,NextResponse} from 'next/server';
import {requireOwnerSession} from '@/lib/server/owner';
import {reviewCommandsEnabled} from '@/lib/server/reviewCommands';
import {readStatistics,readReactions,createExport,readExport} from '@/lib/server/reviewReporting';
import {parseBoardQuery} from '@/lib/reviewBoards';
import {isUuid} from '@/lib/reviewCommands';
import {integerParameter} from '@/lib/reviewReporting';
import {hasSameOrigin} from '@/lib/requestOrigin';

const json=(value:unknown,status=200)=>NextResponse.json(value,{status,headers:{'Cache-Control':'no-store'}});
async function gate(req:NextRequest,write=false) {
  try {await requireOwnerSession();}catch{return json({error:'Unauthorized'},401);}
  if(write && !hasSameOrigin(req.headers))return json({error:'Forbidden'},403);
  if(!reviewCommandsEnabled())return json({error:'disabled'},503);
}
function storageError(error:unknown) {
  const code=(error as {code?:string})?.code;
  return json({error:code==='22023'?'invalid_or_expired_export':code==='P0002'?'not_found':'storage_unavailable'},code==='22023'?422:code==='P0002'?404:503);
}
export async function GET(req:NextRequest) {
  const denied=await gate(req);if(denied)return denied;
  const p=req.nextUrl.searchParams;
  let read:()=>Promise<unknown>;
  try {
    if(p.get('report')==='statistics') {
      const {filters}=parseBoardQuery(p);
      const threshold=p.has('threshold')?integerParameter(p.get('threshold'),0,31536000):null;
      if(threshold===0)throw new Error('invalid_threshold');
      read=()=>readStatistics(filters,threshold);
    } else if(p.get('report')==='history') {
      const link=p.get('link'),at=p.get('before'),id=p.get('beforeId');
      if(!link || link.length>2000 || ((at || id) && (!at || !isUuid(id) || !Number.isFinite(Date.parse(at)))))throw new Error('invalid_history');
      read=()=>readReactions(link,at && id?{at,id}:undefined);
    } else if(p.get('report')==='export') {
      const id=p.get('id'),after=integerParameter(p.get('after'),0,Number.MAX_SAFE_INTEGER);
      if(!isUuid(id))throw new Error('invalid_id');
      read=()=>readExport(id,after);
    } else throw new Error('invalid_kind');
  }catch{return json({error:'invalid_query'},400);}
  try{return json(await read());}catch(e){return storageError(e);}
}
export async function POST(req:NextRequest) {
  const denied=await gate(req,true);if(denied)return denied;
  let id:string,filters;
  try {
    const raw=await req.text();if(raw.length>8192)throw new Error('body_too_large');
    const body=JSON.parse(raw);
    if(!body || Object.keys(body).some(k=>!['id','query'].includes(k)) || !isUuid(body.id) || typeof body.query!=='string')throw new Error('invalid_export');
    const parsed=parseBoardQuery(new URLSearchParams(body.query));
    if(parsed.board!=='review' || Object.keys(parsed.cursors).length)throw new Error('training_only');
    id=body.id;filters=parsed.filters;
  }catch{return json({error:'invalid_export'},400);}
  try{return json(await createExport(id,filters));}catch(e){return storageError(e);}
}
