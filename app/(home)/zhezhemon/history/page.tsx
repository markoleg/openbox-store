import {redirect} from 'next/navigation'
import {requireOwnerSession} from '@/lib/server/owner'
import {deliveryView,resolveDispatch,reviewDatabase} from '@/lib/server/reviewCommands'
import {isUuid} from '@/lib/reviewCommands'
export default async function HistoryPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  await requireOwnerSession();const p=await searchParams;
  let event=isUuid(p.event)?p.event:null;
  const token=p.dispatch ?? p.ctx;
  const target=token?await resolveDispatch(token):isUuid(p.delivery)?{kind:'delivery',target:p.delivery}:null;
  if(target?.kind==='delivery')event=(await deliveryView(target.target))?.eventId ?? null;
  else if(target?.kind==='event')event=target.target;
  if(event){const {data,error}=await reviewDatabase().from('review_board_rows').select('id,stage').eq('event_id',event).maybeSingle();
    if(error)throw new Error('review_storage_failed');
    if(data)redirect(`/zhezhemon/${data.stage==='processed'?'processed':'processing'}?${new URLSearchParams({card:data.id,...(p.action?{action:p.action}:{})})}`);
  }
  return <main><h1>Картка не входить до основної черги</h1><p>На борді є лише підтверджені сповіщення основного чату.</p><a href="/zhezhemon/processing">Відкрити нові сповіщення</a></main>;
}
