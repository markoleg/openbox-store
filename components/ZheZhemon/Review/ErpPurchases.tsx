import { dateLabel, erpPurchaseBadge, type CardErpPurchases } from '@/lib/reviewBoards'
import type { ListingErpPurchase } from '@/lib/server/reviewBoards'
import styles from './Boards.module.css'

const conditionLabels: Record<NonNullable<ListingErpPurchase['purchase_condition_class']>, string> = {NEW: 'New', OPENBOX: 'Open box'}

export function ErpPurchaseTag({card}:{card:CardErpPurchases}) {
    const label=erpPurchaseBadge(card)
    if(!label)return null
    return <span className={card.buyer_bought?styles.erp_confirmed:styles.erp_only} data-erp-purchase={card.buyer_bought?'confirmed':'erp_only'}>{label}</span>
}

/**
 * Every ERP purchase of the listing; the ERP, not the button, is the record of what was bought.
 * Purchases counted for this card (after its notification, before the next one) are marked.
 */
export default function ErpPurchases({rows}:{rows:ListingErpPurchase[]}) {
    const live=rows.filter(row=>!row.removed_at && row.units>0), after=rows.filter(row=>row.after_notification)
    const units=(list:ListingErpPurchase[])=>list.reduce((sum,row)=>sum+row.units,0)
    return <section><h3>Закупівлі ERP · після цього сповіщення {units(after)} шт</h3>
        <p className={styles.muted}>Усього з цього лінка: {units(live)} шт у {live.length} закупівлях. Сповіщенню зараховано закупівлі, внесені в ERP після нього й до наступного сповіщення цього лінка (не пізніше 72 год).</p>
        {rows.length ? <div className={styles.tableScroll}><table><thead><tr><th>Дата</th><th>Шт</th><th>Партійний · стан</th><th>Жежемон дізнався</th></tr></thead><tbody>
            {rows.map(row=><tr key={`${row.erp_purchase_id}-${row.erp_product_id}`} className={row.removed_at?styles.muted:row.after_notification?styles.erp_after:undefined} data-after-notification={row.after_notification || undefined}>
                <td>{new Date(row.purchase_date).toLocaleDateString('uk-UA',{timeZone:'UTC'})}</td>
                <td>{row.units}{row.cancelled_units?` · скасовано ${row.cancelled_units}`:''}</td>
                <td>{row.model_number ?? '—'} · {row.purchase_condition_class?conditionLabels[row.purchase_condition_class]:'стан не визначено'}</td>
                <td>{dateLabel(row.first_synced_at)}{row.removed_at?` · знято з ERP ${dateLabel(row.removed_at)}`:''}{row.reaction_id?' · закрила сповіщення':''}{row.after_notification?' · ← після цього сповіщення':''}</td>
            </tr>)}
        </tbody></table></div> : <p className={styles.muted}>В ERP немає закупівель з цього лінка.</p>}
    </section>
}
