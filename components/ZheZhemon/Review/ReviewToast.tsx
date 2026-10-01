 'use client'
import {useState} from 'react'
import Link from 'next/link'
import {useReviewAction} from './useReviewAction'
import {PAUSE_DAYS,type ReviewAction,type ReviewPayload} from '@/lib/reviewCommands'
import styles from './ReviewToast.module.css'
export type ToastEvent = {
    event_id: string
    link: string
    kind: string
    channel: string
    search_id: number | null
    availability: string | null
    summary: {
        title?: string; total_price?: number | string; shipping_cost?: number | string; condition?: string
        seller_name?: string; feedback_score?: number; feedback_percentage?: number; old_total?: number | string
        desired_price?: number | string; itemWebUrl?: string
    }
}

export default function ReviewToast({event}:{event:ToastEvent}){
  const {run,pending}=useReviewAction({kind:'event',eventId:event.event_id},'dashboard_toast'),[outcome,setOutcome]=useState(''),[pause,setPause]=useState(false);
  async function decide(action:ReviewAction,payload:ReviewPayload={},label:string){const result=await run(action,payload);if(result && ['applied','noop'].includes(result.status))setOutcome(label)}
  const href=`/zhezhemon/history?${new URLSearchParams({event:event.event_id})}`;
  return <div className={styles.content} onClick={e=>e.stopPropagation()}><p className={styles.summary}><a href={event.link} target="_blank" rel="noopener noreferrer">{event.summary.title ?? event.link}</a><br/>${event.summary.total_price ?? '?'} · {event.summary.condition}</p>
    {outcome?<p role="status">{outcome}</p>:<div className={styles.actions} role="group" aria-label="Дії зі сповіщенням">
      <button disabled={!!pending} onClick={()=>decide('set_outcome',{value:'missed'},'Не встиг')}>⏱ Не встиг</button>
      <button disabled={!!pending} onClick={()=>decide('set_outcome',{value:'funds'},'Кошти / ліміт')}>💰 Кошти</button>
      <Link href={href+'&action=bug'} aria-disabled={!!pending} tabIndex={pending?-1:undefined} onClick={e=>{if(pending)e.preventDefault()}}>🐞 Баг</Link>
      <button disabled={!!pending} onClick={()=>decide('hide',{},'Приховано')}>🙈 Приховати</button>
      <button disabled={!!pending} aria-expanded={pause} onClick={()=>setPause(v=>!v)}>⏸ Пауза</button>
      <button disabled={!!pending || event.search_id===null} onClick={()=>decide('ban',{},'Бан')}>🚫 Бан</button>
      {pause && <div className={styles.pause} role="group" aria-label="Тривалість паузи">{PAUSE_DAYS.map(days=><button key={days} disabled={!!pending} onClick={()=>decide('pause',{days},'Пауза')}>{days}д</button>)}</div>}
    </div>}
    <p className={styles.links}><Link href={href}>Картка ↗</Link><Link href={`/sniper?${new URLSearchParams({link:event.link,event:event.event_id})}`}>Sniper ↗</Link></p>
  </div>
}
