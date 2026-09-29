import { dateLabel, erpPurchaseBadge, type CardErpPurchases } from '@/lib/reviewBoards'
import type { ListingErpPurchase } from '@/lib/server/reviewBoards'
import styles from './Boards.module.css'

const conditionLabels: Record<NonNullable<ListingErpPurchase['purchase_condition_class']>, string> = {NEW: 'New', OPENBOX: 'Open box'}

export function ErpPurchaseTag({card}:{card:CardErpPurchases}) {
    const label=erpPurchaseBadge(card)
    if(!label)return null
    return <span className={card.buyer_bought?styles.erp_confirmed:styles.erp_only} data-erp-purchase={card.buyer_bought?'confirmed':'erp_only'}>{label}</span>
}

/** Every ERP purchase of the listing; the ERP, not the button, is the record of what was bought. */
export default function ErpPurchases({rows}:{rows:ListingErpPurchase[]}) {
    return <section><h3>Закупівлі ERP · {rows.filter(row=>!row.removed_at && row.units>0).length}</h3>
        {rows.length ? <div className={styles.tableScroll}><table><thead><tr><th>Дата</th><th>Шт</th><th>Партійний · стан</th><th>Жежемон дізнався</th></tr></thead><tbody>
            {rows.map(row=><tr key={`${row.erp_purchase_id}-${row.erp_product_id}`} className={row.removed_at?styles.muted:undefined}>
                <td>{new Date(row.purchase_date).toLocaleDateString('uk-UA',{timeZone:'UTC'})}</td>
                <td>{row.units}{row.cancelled_units?` · скасовано ${row.cancelled_units}`:''}</td>
                <td>{row.model_number ?? '—'} · {row.purchase_condition_class?conditionLabels[row.purchase_condition_class]:'стан не визначено'}</td>
                <td>{dateLabel(row.first_synced_at)}{row.removed_at?` · знято з ERP ${dateLabel(row.removed_at)}`:''}{row.reaction_id?' · закрила сповіщення':''}</td>
            </tr>)}
        </tbody></table></div> : <p className={styles.muted}>В ERP немає закупівель з цього лінка.</p>}
    </section>
}
