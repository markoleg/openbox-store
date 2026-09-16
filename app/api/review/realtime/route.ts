import {NextResponse} from 'next/server';
import {requireOwnerSession} from '@/lib/server/owner';
import {reviewCommandsEnabled, reviewDatabase} from '@/lib/server/reviewCommands';
import {ownedRealtimeChannel} from '@/lib/realtimeChannel';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

const encoder = new TextEncoder();

export async function GET(req:Request) {
  try { await requireOwnerSession(); }
  catch { return NextResponse.json({error:'Unauthorized'},{status:401}); }
  if (!reviewCommandsEnabled()) return NextResponse.json({error:'disabled'},{status:503});

  const db=reviewDatabase();
  let channel:ReturnType<typeof db.channel> | null=null;
  let heartbeat:ReturnType<typeof setInterval> | null=null;
  let ended=false;
  let detach=()=>{};
  const stream=new ReadableStream<Uint8Array>({
    start(controller) {
      const send=(event:string,data='{}')=>{
        if(ended)return;
        try { controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`)); }
        catch { void cleanup(); }
      };
      const cleanup=async()=>{
        if(ended)return;ended=true;detach();
        if(heartbeat)clearInterval(heartbeat);
        if(channel)await db.removeChannel(channel).catch(()=>undefined);
        try{controller.close()}catch{/* already closed by the client/runtime */}
      };
      detach=()=>req.signal.removeEventListener('abort',cleanup);
      req.signal.addEventListener('abort',cleanup,{once:true});
      heartbeat=setInterval(()=>send('heartbeat'),15000);
      channel=ownedRealtimeChannel(db,'owner-review-boards')
        .on('postgres_changes',{event:'UPDATE',schema:'public',table:'review_realtime_signal'},()=>send('invalidate'));
      channel.subscribe(status=>{
        if(status==='SUBSCRIBED')send('ready');
        else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')send('unavailable');
        else if(status==='CLOSED'&&!ended)send('unavailable');
      });
      // Flush headers immediately while the upstream subscription is joining.
      send('connecting');
    },
    cancel() {
      if(ended)return;ended=true;detach();
      if(heartbeat)clearInterval(heartbeat);
      if(channel)void db.removeChannel(channel).catch(()=>undefined);
    },
  });
  return new Response(stream,{headers:{
    'Content-Type':'text/event-stream; charset=utf-8',
    'Cache-Control':'no-store, no-cache, must-revalidate, no-transform',
    'X-Accel-Buffering':'no',
  }});
}
