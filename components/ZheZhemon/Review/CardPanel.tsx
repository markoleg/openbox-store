'use client'
import {useCallback,useEffect,useRef,useState} from 'react'
import {useSearchParams} from 'next/navigation'
import Link from 'next/link'
import type {CardDetail,ListingErpPurchase} from '@/lib/server/reviewBoards'
import {dateLabel,searchLabel,type Board,type BoardCard} from '@/lib/reviewBoards'
import {applyCommand,issueContext,explainError,explainResult} from '@/lib/reviewClient'
import {tokenFromDispatchId,type ReviewAction,type ReviewPayload,type ReviewContext} from '@/lib/reviewCommands'
import {outcomeLabels} from '@/lib/reviewKeyboard'
import OutcomeForm from './OutcomeForm'
import ErpPurchases from './ErpPurchases'
import ManualPurchaseForm from './ManualPurchaseForm'
import PartNumberForm from './PartNumberForm'
import CapturedData from './CapturedData'
import styles from './Boards.module.css'
export default function CardPanel({board,id,initialCard,externalVersion,onClose,onChanged}:{board:Board;id:string;initialCard?:BoardCard;externalVersion:number;onClose:()=>void;onChanged:()=>void}){
  const [data,setData]=useState<CardDetail|null>(null),[context,setContext]=useState<ReviewContext|null>(null),[error,setError]=useState(''),[message,setMessage]=useState('');
  const [refresh,setRefresh]=useState(0),[pending,setPending]=useState(false),[stale,setStale]=useState(false);
  const dirty=useRef(false),dialog=useRef<HTMLDivElement>(null),closeButton=useRef<HTMLButtonElement>(null),closeRef=useRef(onClose),seenExternal=useRef(externalVersion);
  const dirtyForms=useRef({purchase:false,outcome:false});
  const initial=useRef(initialCard).current;
  const deliveryHint=useRef(initial?.delivery_id);
  const markDirty=(form:'purchase'|'outcome',value:boolean)=>{dirtyForms.current[form]=value;dirty.current=dirtyForms.current.purchase || dirtyForms.current.outcome};
  const resetDirty=()=>{dirtyForms.current={purchase:false,outcome:false};dirty.current=false};
  closeRef.current=onClose;const params=useSearchParams();
  const close=()=>{if(!dirty.current || confirm('Є незбережений текст. Закрити картку?'))closeRef.current()};
  const changed=useCallback(()=>{if(dirty.current)setStale(true);else{setRefresh(v=>v+1);setStale(false)}onChanged()},[onChanged]);
  useEffect(()=>{
    const prior=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;document.body.style.overflow='hidden';closeButton.current?.focus();
    const keyboard=(e:KeyboardEvent)=>{
      if(e.key==='Escape'){e.preventDefault();close()}
      if(e.key==='Tab'){const all=Array.from(dialog.current?.querySelectorAll<HTMLElement>('a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary') ?? []).filter(el=>el.getClientRects().length>0),first=all[0],last=all.at(-1);
        if(e.shiftKey && document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey && document.activeElement===last){e.preventDefault();first?.focus()}}
    };
    const before=(e:BeforeUnloadEvent)=>{if(dirty.current){e.preventDefault();e.returnValue=''}};
    document.addEventListener('keydown',keyboard);window.addEventListener('beforeunload',before);
    return ()=>{document.removeEventListener('keydown',keyboard);window.removeEventListener('beforeunload',before);document.body.style.overflow=overflow;prior?.focus()};
  },[]);
  useEffect(()=>{if(seenExternal.current===externalVersion)return;seenExternal.current=externalVersion;if(dirty.current)setStale(true);else setRefresh(v=>v+1)},[externalVersion]);
  useEffect(()=>{
    const abort=new AbortController();setContext(null);setError('');
    // The queue already knows the delivery. Start its context without waiting for details.
    // Handle rejection immediately so a failed parallel request is never unhandled.
    const prepare=(deliveryId:string)=>issueContext({kind:'delivery',deliveryId}).then(value=>({value}),error=>({error}));
    const contextRequest=deliveryHint.current?prepare(deliveryHint.current):null;
    fetch(`/api/review/boards?tab=${board}&id=${id}`,{signal:abort.signal,cache:'no-store'}).then(async response=>{if(!response.ok)throw new Error(response.status===404?'Картки немає в основній черзі.':'Не вдалося завантажити картку.');return response.json() as Promise<CardDetail>})
      .then(async detail=>{
        if(abort.signal.aborted)return;setData(detail);deliveryHint.current=detail.card.delivery_id;
        const result=await(contextRequest ?? prepare(detail.card.delivery_id));
        if(abort.signal.aborted)return;
        if('error' in result){setError('Дані картки завантажено, але дії недоступні. Онови картку.');return}
        const pinned=result.value;
        if(pinned.delivery_id!==detail.card.delivery_id || pinned.result_version!==detail.card.state_version){setStale(true);setMessage('Картка змінилась під час відкриття. Онови її.');return}setContext(pinned)
      })
      .catch(e=>{if(!abort.signal.aborted)setError(e.message)});
    return ()=>abort.abort();
  },[board,id,refresh]);
  async function run(action:ReviewAction,payload:ReviewPayload={}){
    if(!context || pending || stale)return null;setPending(true);setMessage('');
    try{let result=await applyCommand(context.id,action,payload);
      if(action==='hide' && result.reason==='price_changed' && result.currentPrice!==undefined && data &&
        confirm(`Ціна змінилась: $${result.contextPrice} → $${result.currentPrice}. Сховати до подешевшання від поточної ціни?`)){
        const fresh=await issueContext({kind:'delivery',deliveryId:data.card.delivery_id});
        result=await applyCommand(fresh.id,'hide',{confirmedPrice:result.currentPrice});
      }
      setMessage(explainResult(action,result).text);
      if(['applied','noop'].includes(result.status)){
        markDirty(action==='set_manual_purchase' || action==='clear_manual_purchase'?'purchase':'outcome',false);changed();
      }else if(result.status==='conflict'){setStale(true);setContext(null)}return result;
    }catch(e){setMessage(explainError(e));return null}finally{setPending(false)}
  }
  async function assign(row:ListingErpPurchase,value:boolean){
    if(!context || pending || stale)return;setPending(true);setMessage('');
    try{const body={commandId:crypto.randomUUID(),contextId:context.id,key:row.order_key,version:row.version,assign:value};
      const send=()=>fetch('/api/review/purchases',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      let response;try{response=await send()}catch{response=await send()}
      const result=await response.json();if(['applied','noop'].includes(result.status)){setMessage(value?'Закупку прив’язано.':'Закупку відв’язано.');changed()}
      else{setMessage(result.status==='conflict'?'Дані вже змінились. Онови картку.':'Не вдалося змінити прив’язку.');setStale(true);setContext(null)}
    }catch(e){setMessage(explainError(e))}finally{setPending(false)}
  }
  function reload(){if(!dirty.current || confirm('Оновити й відкинути незбережений текст?')){resetDirty();setStale(false);setRefresh(v=>v+1)}}
  const view=data?.view,locked=pending || !context || stale;
  return <div className={styles.overlay} onMouseDown={e=>{if(e.target===e.currentTarget)close()}}><div ref={dialog} className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="card-title">
    <div className={styles.cardHeader}><div className={styles.cardHeading}><p id="card-title">{data?.card.title ?? initial?.title ?? 'Завантаження…'}</p></div><div className={styles.cardActions}><button onClick={reload}>Оновити</button><button ref={closeButton} onClick={close}>Закрити ×</button></div></div>
    <div className={styles.cardBody}>
      {error && <p role="alert" className={styles.error}>{error}</p>}{message && <p role="status">{message}</p>}
      {stale && <p role="alert" className={styles.error}>Дані змінились. Онови картку перед наступною дією.</p>}
      {!data && !error && initial && <div aria-busy="true">
        <h2>{initial.title}</h2><p><a href={initial.link} target="_blank" rel="noopener noreferrer">Відкрити на eBay ↗</a></p>
        <p>{dateLabel(initial.sent_at)} · {searchLabel(initial)}</p>
        <p className={styles.muted}>Завантажую деталі…</p>
      </div>}
      {data && <>
        <h2>{data.card.title}</h2><p><a href={data.card.link} target="_blank" rel="noopener noreferrer">Відкрити на eBay ↗</a></p>
        <p>{dateLabel(data.card.sent_at)} · {searchLabel(data.card)}</p>
        <section><h3>Результат повідомлення</h3>
          {data.card.legacy_outcome && <p className={styles.muted}>Старе рішення: {data.card.legacy_outcome==='manual_bought'?'«Купив» без підтвердження ERP':'«Приховав би»'}. Його можна виправити.</p>}
          {data.card.note && <p>{data.card.note}</p>}
          {data.card.outcome==='bought' && data.card.manual_outcome && <p className={styles.muted}>Ручне рішення збережено на випадок скасування закупки: {outcomeLabels[data.card.manual_outcome]}.</p>}
          <ManualPurchaseForm key={'purchase-'+data.card.event_id+'-'+refresh} card={data.card} execute={run} locked={locked} onDirty={value=>markDirty('purchase',value)}/>
          <OutcomeForm key={data.card.event_id+'-'+refresh} current={{outcome:data.card.outcome,hidden:!!view?.live.hidden,bannedInSearch:view?.live.bannedInSearch ?? null,erpConfirmed:data.card.erp_purchases>0}} execute={run} locked={locked} initialAction={params.get('action')} onDirty={value=>markDirty('outcome',value)}/>
          <button disabled={locked} onClick={()=>run('set_like',{value:!view?.live.liked})}>{view?.live.liked?'Зняти лайк':'Лайк'}</button>
          {view && <p><Link href={`/sniper?${new URLSearchParams({link:data.card.link,ctx:tokenFromDispatchId(view.dispatchId)})}`}>Налаштувати Sniper</Link></p>}
        </section>
        <ErpPurchases rows={data.erpPurchases} eventId={data.card.event_id} assign={assign} locked={locked}/>
        <PartNumberForm key={data.partNumber?.version ?? 0} link={data.card.link} partNumber={data.partNumber} onSaved={changed}/>
        <p className={styles.muted}>Зараз: {view?.live.hidden?`приховано${view.live.hiddenUntil?' до '+dateLabel(view.live.hiddenUntil):' до подешевшання'}`:'видиме'}{view?.live.bannedInSearch?' · бан у цьому пошуку':''}{view?.live.stockBlocked?' · недоступне':''}</p>
        <CapturedData data={data}/>
      </>}
    </div>
  </div></div>
}
