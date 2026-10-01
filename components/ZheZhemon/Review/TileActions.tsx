'use client'
import {useState} from 'react'
import {useReviewAction} from './useReviewAction'
import {PAUSE_DAYS,type ReviewAction,type ReviewPayload} from '@/lib/reviewCommands'
import type {BoardCard} from '@/lib/reviewBoards'
import styles from './Boards.module.css'
export default function TileActions({card,onChanged,onOpen}:{card:BoardCard;onChanged:()=>void;onOpen:(action:'bug')=>void}){
  const {run,pending}=useReviewAction({kind:'delivery',deliveryId:card.delivery_id}),[pause,setPause]=useState(false);
  async function apply(action:ReviewAction,payload:ReviewPayload={}){const result=await run(action,payload);if(result && ['applied','noop','conflict'].includes(result.status))onChanged()}
  return <div className={styles.quickActions} role="group" aria-label={`Результат: ${card.title}`}>
    <button disabled={!!pending} onClick={()=>apply('set_outcome',{value:'missed'})}>⏱ Не встиг</button>
    <button disabled={!!pending} onClick={()=>apply('set_outcome',{value:'funds'})}>💰 Кошти</button>
    <button disabled={!!pending} onClick={()=>onOpen('bug')}>🐞 Баг</button>
    <button disabled={!!pending} onClick={()=>apply('hide')}>🙈 Приховати</button>
    <button disabled={!!pending} aria-expanded={pause} onClick={()=>setPause(v=>!v)}>⏸ Пауза</button>
    <button disabled={!!pending || card.search_id===null} onClick={()=>apply('ban')}>🚫 Бан</button>
    {pause && PAUSE_DAYS.map(days=><button key={days} disabled={!!pending} onClick={()=>apply('pause',{days})}>{days}д</button>)}
  </div>
}
