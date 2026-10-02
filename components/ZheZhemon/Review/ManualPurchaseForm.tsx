'use client'
import {useState} from 'react'
import type {ReviewAction,ReviewPayload,ReviewCommandResult} from '@/lib/reviewCommands'
import {dateLabel,manualPurchaseBadge,type CardErpPurchases} from '@/lib/reviewBoards'
import styles from './Boards.module.css'

type Props={card:CardErpPurchases;locked:boolean;execute:(action:ReviewAction,payload?:ReviewPayload)=>Promise<ReviewCommandResult|null>;onDirty:(dirty:boolean)=>void};
export default function ManualPurchaseForm({card,locked,execute,onDirty}:Props){
  const initial=String(card.manual_purchase_quantity ?? Math.max(card.erp_units,1));
  const [open,setOpen]=useState(false),[quantity,setQuantity]=useState(initial),[cancel,setCancel]=useState(false),[reason,setReason]=useState('');
  const units=Number(quantity),valid=/^\d+$/.test(quantity) && Number.isSafeInteger(units) && units>=1 && units<=1000000;
  const label=manualPurchaseBadge(card);
  function close(){setOpen(false);setCancel(false);setQuantity(initial);setReason('');onDirty(false)}
  async function submit(action:ReviewAction,payload:ReviewPayload){
    const result=await execute(action,payload);if(result && ['applied','noop'].includes(result.status))close();
  }
  return <div className={styles.manualPurchase}>
    {label && <p>{label}</p>}
    {card.manual_purchase_quantity && <p className={styles.muted}>Вручну заявлено всього {card.manual_purchase_quantity} шт. · {dateLabel(card.manual_purchase_at ?? null)}
      {card.manual_purchase_pending_units===0?' · кількість підтверджена ERP':''}</p>}
    <div className={styles.actions}>
      <button disabled={locked} aria-expanded={open} onClick={()=>{if(open)close();else{setCancel(false);setReason('');setOpen(true)}}}>
        {card.manual_purchase_quantity?'Змінити кількість «Купив»':'✅ Купив вручну'}
      </button>
      {card.manual_purchase_quantity && <button disabled={locked} aria-expanded={cancel} onClick={()=>{if(cancel)close();else{setOpen(false);setQuantity(initial);setCancel(true);onDirty(false)}}}>Скасувати ручну позначку</button>}
    </div>
    {open && <form onSubmit={event=>{event.preventDefault();if(valid)void submit('set_manual_purchase',{quantity:units})}}>
      <label>Куплено через цю картку, шт.<input type="number" inputMode="numeric" min="1" max="1000000" step="1" value={quantity} disabled={locked}
        onChange={event=>{setQuantity(event.target.value);onDirty(event.target.value!==initial)}} required/></label>
      <p className={styles.muted}>Загальна кількість, включно з уже прив’язаними закупками ERP. Наприклад, дві закупки по 1 шт. — вкажи 2. Закупку в ERP ця позначка не створює.</p>
      <div className={styles.actions}><button disabled={locked || !valid}>Зберегти «Купив»</button><button type="button" disabled={locked} onClick={close}>Закрити введення</button></div>
    </form>}
    {cancel && <form onSubmit={event=>{event.preventDefault();if(reason.trim())void submit('clear_manual_purchase',{reason:reason.trim()})}}>
      <label>Причина скасування «Купив»<input value={reason} maxLength={1000} disabled={locked} onChange={event=>{setReason(event.target.value);onDirty(!!event.target.value)}} required/></label>
      <p className={styles.muted}>Скасовується лише ручна позначка. Закупки ERP та попередній результат картки залишаються.</p>
      <div className={styles.actions}><button disabled={locked || !reason.trim()}>Скасувати «Купив»</button><button type="button" disabled={locked} onClick={close}>Закрити скасування</button></div>
    </form>}
  </div>
}
