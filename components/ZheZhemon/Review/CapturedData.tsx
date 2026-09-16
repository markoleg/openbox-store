'use client'
import { useId, useState } from 'react'
import type { CardDetail } from '@/lib/server/reviewBoards'
import { dateLabel } from '@/lib/reviewBoards'
import { availabilityLabel, corridorLabel, formatMoney, sectionLabels, sellerLine, type Aspect, type CapturedListingView } from '@/lib/capturedListing'
import PhotoGallery from './PhotoGallery'
import styles from './Boards.module.css'

const ASPECT_PREVIEW=8, LONG_DESCRIPTION=600

export function CapturedDataSummary({captured}:{captured:CapturedListingView}) {
    const {provenance}=captured
    return <>
        <p className={styles.muted}>Знімок: {provenance.sourceLabel} · {dateLabel(provenance.observedAt)}. Історичні дані на момент повідомлення, не поточний стан eBay.</p>
        {provenance.fallbackNote && <p className={styles.note} role="note">{provenance.fallbackNote}{captured.missing.length ? ` Недоступно: ${captured.missing.map(s=>sectionLabels[s]).join(', ')}.` : ''}</p>}
    </>
}

export function AvailabilityFact({captured}:{captured:CapturedListingView}) {
    const {availability,price}=captured
    return <div className={styles.facts}>
        <span className={styles.fact} data-status={availability.status}>📦 {availabilityLabel(availability)}</span>
        {price.total && <span className={styles.fact}>{formatMoney(price.item) ?? '—'}{price.shipping ? ` + ${Number(price.shipping.amount)===0 ? 'безкоштовна доставка' : formatMoney(price.shipping)+' доставка'}` : ''} = <strong>{formatMoney(price.total)}</strong></span>}
        {availability.conflicting && <span className={styles.muted}>Дані наявності суперечливі; деталі в технічних даних.</span>}
    </div>
}

export function SellerFacts({captured}:{captured:CapturedListingView}) {
    if(!captured.seller)return null
    return <div className={styles.subsection} role="group" aria-labelledby="captured-shop"><h4 id="captured-shop">Продавець</h4><p>{sellerLine(captured.seller)}</p></div>
}

function AspectRow({aspect}:{aspect:Aspect}) {
    return <div className={styles.aspectRow}><dt>{aspect.name}</dt><dd>{aspect.values.join(', ')}</dd></div>
}
export function AspectList({aspects}:{aspects:Aspect[]}) {
    const [all,setAll]=useState(false)
    if(!aspects.length)return null
    const shown=all ? aspects : aspects.slice(0,ASPECT_PREVIEW)
    return <div className={styles.subsection} role="group" aria-labelledby="captured-aspects"><h4 id="captured-aspects">Параметри</h4>
        <dl className={styles.aspects}>{shown.map((a,i)=><AspectRow key={`${i}-${a.name}`} aspect={a}/>)}</dl>
        {aspects.length>ASPECT_PREVIEW && <button type="button" aria-expanded={all} onClick={()=>setAll(v=>!v)}>{all ? 'Згорнути параметри' : `Показати всі ${aspects.length}`}</button>}
    </div>
}

export function SafeDescription({description}:{description:CardDetail['description']}) {
    const [expanded,setExpanded]=useState(false), id=useId()
    if(!description)return null
    const long=description.length>LONG_DESCRIPTION
    return <div className={styles.subsection} role="group" aria-labelledby="captured-description"><h4 id="captured-description">Опис продавця</h4>
        <div id={id} className={styles.description} data-collapsed={long && !expanded ? 'true' : undefined}>
            {description.kind==='html'
                // Server-side allowlist output only (sanitizeDescription); raw seller HTML never reaches this prop.
                ? <div className={styles.descriptionHtml} dangerouslySetInnerHTML={{__html:description.html}}/>
                : <p className={styles.descriptionText}>{description.text}</p>}
        </div>
        {long && <button type="button" aria-expanded={expanded} aria-controls={id} onClick={()=>setExpanded(v=>!v)}>{expanded ? 'Згорнути опис' : 'Розгорнути весь опис'}</button>}
    </div>
}

export function PriceBreakdown({captured}:{captured:CapturedListingView}) {
    const {price}=captured
    if(!price.item && !price.shipping && !price.total)return null
    const currency=price.item?.currency ?? price.total?.currency ?? null
    const corridor=corridorLabel(price.corridor,currency)
    return <div className={styles.subsection} role="group" aria-labelledby="captured-price"><h4 id="captured-price">Ціна та умови пошуку</h4>
        <p>Товар {formatMoney(price.item) ?? 'невідомо'}
            {price.shipping ? ` · доставка ${Number(price.shipping.amount)===0 ? 'безкоштовна' : formatMoney(price.shipping)}` : ' · доставка невідома'}
            {price.total ? <> · разом <strong>{formatMoney(price.total)}</strong></> : null}</p>
        {price.shippingFromSearch && <p className={styles.muted}>Доставка — за даними пошуку, не з детальної відповіді.</p>}
        {corridor && <p className={styles.muted}>Коридор пошуку: {corridor}</p>}
    </div>
}

function CopyJson({value}:{value:unknown}) {
    const [state,setState]=useState<'idle'|'done'|'failed'>('idle')
    return <span className={styles.copy}>
        <button type="button" onClick={async()=>{try{await navigator.clipboard.writeText(JSON.stringify(value ?? null,null,2));setState('done')}catch{setState('failed')}}}>Копіювати JSON</button>
        {state!=='idle' && <span role="status" className={styles.muted}>{state==='done' ? 'Скопійовано' : 'Не вдалося скопіювати'}</span>}
    </span>
}
const json=(v:unknown)=>JSON.stringify(v ?? null,null,2)
export function TechnicalSnapshot({data}:{data:CardDetail}) {
    const {snapshot,photos,search,captured}=data
    const metadata=snapshot ? {id:snapshot.id,source:snapshot.source,observed_at:snapshot.observed_at,stock_snapshot_id:data.card.stock_snapshot_id} : null
    return <details className={styles.technical}><summary>Технічні дані</summary>
        <p className={styles.muted}>Вихідні дані знімка як текст. Відкриття, копіювання й фото не викликають getItem; фото зберігаються лише як зовнішні URL eBay.</p>
        <details><summary>Метадані знімка</summary>{metadata ? <><CopyJson value={metadata}/><pre>{json(metadata)}</pre></> : <p>Не зафіксовано</p>}</details>
        <details><summary>Дані наявності</summary>{snapshot?.normalized_payload?.estimatedAvailabilities ? <><CopyJson value={snapshot.normalized_payload.estimatedAvailabilities}/><pre>{json(snapshot.normalized_payload.estimatedAvailabilities)}</pre></> : <p>Не зафіксовано</p>}{captured.availability.conflicting && <p className={styles.muted}>Записи available/remaining або статуси суперечать один одному.</p>}</details>
        <details><summary>Нормалізований payload</summary>{snapshot ? <><CopyJson value={snapshot.normalized_payload}/><pre>{json(snapshot.normalized_payload)}</pre></> : <p>Не зафіксовано</p>}</details>
        <details><summary>Сирий payload eBay</summary>{snapshot?.raw_payload ? <><CopyJson value={snapshot.raw_payload}/><pre>{json(snapshot.raw_payload)}</pre></> : <p>Не зафіксовано</p>}</details>
        <details><summary>Метадані фото · {photos.length}</summary>{photos.length ? <><CopyJson value={photos}/><pre>{json(photos)}</pre></> : <p>Не зафіксовано</p>}</details>
        <details><summary>Параметри пошуку на момент події</summary>{Object.keys(search).length ? <><CopyJson value={search}/><pre>{json(search)}</pre></> : <p>Не зафіксовано</p>}</details>
    </details>
}

export default function CapturedData({data,assessmentAnchor}:{data:CardDetail;assessmentAnchor:string|null}) {
    const {captured}=data
    return <section id="captured-data" aria-labelledby="captured-heading">
        <div className={styles.sectionHeader}><h3 id="captured-heading">Дані оголошення на момент повідомлення</h3>{assessmentAnchor && <a href={`#${assessmentAnchor}`} className={styles.anchor}>До оцінки ↓</a>}</div>
        <CapturedDataSummary captured={captured}/>
        <div className={styles.subsection} role="group" aria-labelledby="captured-title"><h4 id="captured-title">Заголовок і стан</h4>
            <p>{data.card.title}</p>
            <p className={styles.muted}>Стан: {captured.condition.label ?? 'не зафіксовано'}</p>
        </div>
        <AvailabilityFact captured={captured}/>
        <SellerFacts captured={captured}/>
        <AspectList aspects={captured.aspects}/>
        <SafeDescription description={data.description}/>
        <PhotoGallery photos={data.photos} title={data.card.title}/>
        <PriceBreakdown captured={captured}/>
        <TechnicalSnapshot data={data}/>
    </section>
}
