'use client'
import { useState } from 'react'
import type { ListingPartNumber } from '@/lib/server/reviewBoards'
import { PART_NUMBER_PATTERN, dateLabel, normalizePartNumber, partNumberBadge, partNumberSourceLabels, type CardPartNumber } from '@/lib/reviewBoards'
import { savePartNumber, explainError } from '@/lib/reviewClient'
import styles from './Boards.module.css'

const statusLabels: Record<ListingPartNumber['status'], string> = {
    identified: 'визначено', not_in_catalog: 'немає в каталозі ERP', ambiguous: 'кілька товарів', unknown: 'не визначено',
    unverified: 'не перевірено ERP',
}

/** Tile and panel badge; highlighted whenever a person has to act. */
export function PartNumberTag({card}:{card:CardPartNumber}) {
    const badge=partNumberBadge(card)
    return <span className={styles[`part_${badge.tone}`]} data-part-number={badge.tone}>{badge.label}</span>
}

/**
 * Drawer editor for the same manual part number exposed on each board tile. The next
 * notification of the link sends it to the CRM, which then counts purchases, stock and margin for it.
 */
export default function PartNumberForm({link,partNumber,onSaved}:{link:string;partNumber:ListingPartNumber|null;onSaved:()=>void}) {
    const manual=partNumber?.manual_part_number ?? null
    const [value,setValue]=useState(manual ?? ''),[pending,setPending]=useState(false),[message,setMessage]=useState('')
    const normalized=normalizePartNumber(value)
    const invalid=normalized!==null && !PART_NUMBER_PATTERN.test(normalized)
    const card:CardPartNumber={part_number:partNumber?.part_number ?? null,part_number_status:partNumber?.status ?? null,
        part_number_source:partNumber?.source ?? null,manual_part_number:manual,part_number_version:partNumber?.version ?? null}
    async function save(next:string|null) {
        if(pending)return
        setPending(true);setMessage('')
        try {
            const result=await savePartNumber({link,partNumber:next,version:partNumber?.version ?? null})
            if(result.status==='applied')setMessage(next?'Збережено. Наступне сповіщення цього лінка прийде з рядком ERP для цього номера.':'Ручне значення прибрано. ERP визначатиме номер з оголошення.')
            else if(result.status==='noop')setMessage('Без змін.')
            else if(result.status==='conflict')setMessage('Номер уже змінено в іншому вікні — картку оновлено.')
            else setMessage(result.reason==='invalid_part_number'?'Невірний формат номера.':'Лінк не знайдено.')
            if(result.status!=='rejected')onSaved()
        }catch(e){setMessage(explainError(e))}
        finally{setPending(false)}
    }
    return <section aria-labelledby="part-number-title">
        <h3 id="part-number-title">Part Number</h3>
        <p className={styles.tags}><PartNumberTag card={card}/></p>
        {partNumber ? <p className={styles.muted}>
            ERP: {partNumber.part_number ?? '—'} · {statusLabels[partNumber.status]}{partNumber.source?` · ${partNumberSourceLabels[partNumber.source]}`:''}
            {partNumber.crm_checked_at?` · перевірено ${dateLabel(partNumber.crm_checked_at)}`:''}
            {manual?<><br/>Вручну: {manual} · {dateLabel(partNumber.manual_at)}</>:null}
        </p> : <p className={styles.muted}>ERP ще не відповідала для цього лінка.</p>}
        <form className={styles.partNumberForm} onSubmit={e=>{e.preventDefault();if(!invalid && normalized!==manual)void save(normalized)}}>
            <label>Вказати вручну
                <input value={value} onChange={e=>setValue(e.target.value)} maxLength={64} placeholder="MXP93 або MXP93LL/A" aria-invalid={invalid} autoComplete="off" spellCheck={false}/>
            </label>
            <button type="submit" disabled={pending || invalid || normalized===manual || normalized===null}>Зберегти</button>
            {manual && <button type="button" disabled={pending} onClick={()=>{setValue('');void save(null)}}>Очистити ручне</button>}
        </form>
        {invalid && <p className={styles.muted}>Лише латинські літери, цифри, «/», «+» і «-», від 3 до 64 символів.</p>}
        {message && <p role="status" className={styles.muted}>{message}</p>}
    </section>
}
