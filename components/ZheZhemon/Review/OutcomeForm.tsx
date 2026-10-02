'use client'
import {useState} from 'react'
import {PAUSE_DAYS,type ReviewAction,type ReviewPayload,type ReviewCommandResult} from '@/lib/reviewCommands'
import {outcomeLabels} from '@/lib/reviewKeyboard'
import styles from './Boards.module.css'
type Props={current:{outcome:string|null;hidden:boolean;bannedInSearch:boolean|null;erpConfirmed?:boolean};execute:(action:ReviewAction,payload?:ReviewPayload)=>Promise<ReviewCommandResult|null>;locked?:boolean;initialAction?:string|null;onDirty?:(dirty:boolean)=>void};
export default function OutcomeForm({current,execute,locked,initialAction,onDirty}:Props){
  const [bug,setBug]=useState(initialAction==='bug'),[note,setNote]=useState(''),[clear,setClear]=useState(false),[reason,setReason]=useState('');
  async function run(action:ReviewAction,payload:ReviewPayload={}){const result=await execute(action,payload);if(result && ['applied','noop'].includes(result.status)){setNote('');setReason('');onDirty?.(false)}}
  return <div>
    <p>{current.outcome?outcomeLabels[current.outcome]:'Результату немає'}</p>
    {current.outcome==='bought' && current.erpConfirmed && <p className={styles.muted}>Є підтвердження ERP. Прив’язку закупки можна виправити нижче.</p>}
    {current.outcome==='purchase_cancelled' && <p className={styles.muted}>Збережено історію скасованої закупки. Щоб прибрати цей результат, відв’яжи закупку нижче.</p>}
    <div className={styles.actions}>
      <button disabled={locked} onClick={()=>run('set_outcome',{value:'missed'})}>⏱ Не встиг</button>
      <button disabled={locked} onClick={()=>run('set_outcome',{value:'funds'})}>💰 Кошти / ліміт</button>
      <button disabled={locked} onClick={()=>setBug(v=>!v)}>🐞 Баг</button>
      <button disabled={locked} onClick={()=>run('hide')}>🙈 Приховати до подешевшання</button>
      {PAUSE_DAYS.map(days=><button key={days} disabled={locked} onClick={()=>run('pause',{days})}>Пауза {days}д</button>)}
      <button disabled={locked || current.bannedInSearch===null} onClick={()=>run('ban')}>🚫 Бан у пошуку</button>
    </div>
    {bug && <form onSubmit={e=>{e.preventDefault();void run('set_outcome',{value:'bug',note:note.trim()})}}><label>Що пішло не так<textarea value={note} maxLength={4000} onChange={e=>{setNote(e.target.value);onDirty?.(!!e.target.value || !!reason)}}/></label><button disabled={locked || !note.trim()}>Записати баг</button></form>}
    <div className={styles.actions}>
      {current.hidden && <button disabled={locked} onClick={()=>run('unhide')}>Показати знову</button>}
      {current.bannedInSearch && <button disabled={locked} onClick={()=>run('unban')}>Зняти бан</button>}
      {current.outcome!=='bought' && current.outcome!=='purchase_cancelled' && <button disabled={locked} onClick={()=>setClear(v=>!v)}>Повернути в «Нові»</button>}
    </div>
    {clear && <form onSubmit={e=>{e.preventDefault();void run('clear_outcome',{reason:reason.trim()})}}><label>Причина виправлення<input value={reason} maxLength={1000} onChange={e=>{setReason(e.target.value);onDirty?.(!!e.target.value || !!note)}}/></label><button disabled={locked || !reason.trim()}>Повернути</button><p className={styles.muted}>Приховування та бан скасовуються окремими кнопками.</p></form>}
  </div>
}
