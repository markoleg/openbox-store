'use client'
import {useState} from 'react'
import type {ListingErpPurchase} from '@/lib/server/reviewBoards'
import {dateLabel,erpPurchaseBadge,type CardErpPurchases} from '@/lib/reviewBoards'
import styles from './Boards.module.css'
export function ErpPurchaseTag({card}:{card:CardErpPurchases}){const label=erpPurchaseBadge(card);return label?<span className={styles.erp_confirmed}>{label}</span>:card.erp_candidates?<span className={styles.part_pending}>ERP · потрібна прив’язка</span>:card.listing_erp_purchases?<span>Закупки лінка: {card.listing_erp_purchases}</span>:null}
export default function ErpPurchases({rows,eventId,assign,locked}:{rows:ListingErpPurchase[];eventId:string;assign:(row:ListingErpPurchase,value:boolean)=>Promise<void>;locked:boolean}){
  const [pending,setPending]=useState(false);
  async function apply(row:ListingErpPurchase,value:boolean){if(pending)return;setPending(true);try{await assign(row,value)}finally{setPending(false)}}
  return <section><h3>Закупки ERP</h3>
    <p className={styles.muted}>Час листа приблизно на 30–40 хв пізніший за замовлення. Кількість закупленого не визначає залишок оголошення.</p>
    {!rows.length?<p>Закупок поки немає.</p>:<div className={styles.tableScroll}><table><thead><tr><th>Закупка</th><th>Кількість</th><th>Прив’язка</th></tr></thead><tbody>{rows.map(row=><tr key={row.order_key} className={row.active && row.assigned_event_id===eventId?styles.erp_after:undefined}>
      <td>{row.lifecycle==='draft'?`Драфт #${row.draft_id}`:row.lifecycle==='withdrawn'?'Прибрано з ERP':`Закупка #${row.purchase_id}`}<br/>{row.time_basis==='email'?`Лист: ${dateLabel(row.email_at)}`:row.time_basis==='order'?`Замовлення: ${dateLabel(row.ordered_at)}`:`Дата: ${row.scope_date}`}</td>
      <td>{row.quantity===null?'Невідома':`${row.quantity} шт`}{row.cancelled_units>0?` · скасовано ${row.cancelled_units}`:''}</td>
      <td>{!row.active?'Не враховується':row.assigned_event_id===eventId?<><p>Ця картка · {row.assignment_source==='manual'?'вручну':'приблизно'}</p><button disabled={locked || pending} onClick={()=>apply(row,false)}>Відв’язати</button></>:<><p>{row.assigned_event_id?'Інша картка':row.assignment_source==='excluded'?'Виключено вручну':'Не прив’язано'}</p><button disabled={locked || pending} onClick={()=>apply(row,true)}>Прив’язати до цієї картки</button></>}</td>
    </tr>)}</tbody></table></div>}
  </section>
}
