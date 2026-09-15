'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import type { CardDetail } from '@/lib/server/reviewBoards'
import type { Board } from '@/lib/reviewBoards'
import { dateLabel, reactionDelay, searchLabel } from '@/lib/reviewBoards'
import { outcomeLabels } from '@/lib/reviewKeyboard'
import { stockLabel } from '@/lib/reviewStock'
import { applyCommand, issueContext, explainError, explainResult } from '@/lib/reviewClient'
import { PAUSE_DAYS, tokenFromDispatchId, type ReviewContext, type ReviewAction, type ReviewPayload, type ReviewCommandResult } from '@/lib/reviewCommands'
import OutcomeForm from './OutcomeForm'
import AssessmentForm from './AssessmentForm'
import ReactionHistory from './ReactionHistory'
import PhotoGallery from './PhotoGallery'
import styles from './Boards.module.css'

function safeListing(url:unknown,fallback:string) {try{const u=new URL(String(url));return u.protocol==='https:' && (u.hostname==='ebay.com'||u.hostname.endsWith('.ebay.com'))?u.href:fallback}catch{return fallback}}
const json=(v:unknown)=>JSON.stringify(v ?? null,null,2)

export default function CardPanel({board,id,onClose,onChanged}:{board:Board;id:string;onClose:()=>void;onChanged:()=>void}) {
    const [data,setData]=useState<CardDetail|null>(null),[error,setError]=useState(''),[message,setMessage]=useState('')
    const [refresh,setRefresh]=useState(0),[pending,setPending]=useState(false),[context,setContext]=useState<ReviewContext|null>(null)
    const [dirty,setDirty]=useState(false)
    const dirtyRef=useRef(false), dialog=useRef<HTMLDivElement>(null), closeButton=useRef<HTMLButtonElement>(null)
    const onCloseRef=useRef(onClose);onCloseRef.current=onClose;dirtyRef.current=dirty
    const router=useRouter(),params=useSearchParams()
    const changed=useCallback(()=>{setRefresh(v=>v+1);onChanged()},[onChanged])
    const close=()=>{if(!dirtyRef.current || confirm('Є незбережені зміни оцінки. Закрити й відкинути їх?'))onCloseRef.current()}
    useEffect(()=>{
        const prior=document.activeElement as HTMLElement|null, overflow=document.body.style.overflow
        document.body.style.overflow='hidden';closeButton.current?.focus()
        const before=(e:BeforeUnloadEvent)=>{if(dirtyRef.current){e.preventDefault();e.returnValue=''}}
        const keyboard=(e:KeyboardEvent)=>{
            if(e.key==='Escape') {e.preventDefault();close()}
            if(e.key==='Tab') {
                const all=Array.from(dialog.current?.querySelectorAll<HTMLElement>('a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary') ?? []).filter(el=>el.getClientRects().length>0)
                const first=all[0],last=all.at(-1)
                if(e.shiftKey && document.activeElement===first){e.preventDefault();last?.focus()}
                else if(!e.shiftKey && document.activeElement===last){e.preventDefault();first?.focus()}
            }
        }
        window.addEventListener('beforeunload',before);window.addEventListener('keydown',keyboard)
        return ()=>{document.body.style.overflow=overflow;prior?.focus();window.removeEventListener('beforeunload',before);window.removeEventListener('keydown',keyboard)}
        // Stable handlers read refs so focus is not reset while typing.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    },[])
    useEffect(()=>{
        let active=true;const abort=new AbortController();setContext(null);setError('')
        ;(async()=>{
            const response=await fetch(`/api/review/boards?${new URLSearchParams({tab:board,id})}`,{signal:abort.signal,cache:'no-store'})
            if(response.status===401){location.href=`/login?next=${encodeURIComponent(location.pathname+location.search)}`;return}
            if(!response.ok)throw new Error(response.status===404?'Картку не знайдено.':'Картка недоступна. Перевір запуск сервера й міграцій.')
            const detail:CardDetail=await response.json()
            if(!active)return
            setData(detail)
            // Pin once for the displayed state, not freshly on every click.
            const ctx=await issueContext({kind:'delivery',deliveryId:detail.card.delivery_id})
            if(!active)return
            if(ctx.result_version!==detail.view?.stateVersion || ctx.listing_version!==detail.view?.live.listingVersion) {
                setError('Стан змінився під час відкриття. Онови картку перед дією.');return
            }
            setContext(ctx)
        })().catch(e=>{if(active && !abort.signal.aborted)setError(e instanceof Error?e.message:'Помилка')})
        return ()=>{active=false;abort.abort()}
    },[board,id,refresh])
    const run=async(action:ReviewAction,payload:ReviewPayload={}):Promise<ReviewCommandResult|null>=>{
        if(pending || !context)return null
        setPending(true);setMessage('')
        try {
            const result=await applyCommand(context.id,action,payload)
            setMessage(explainResult(action,result).text)
            if(result.status==='applied'||result.status==='noop'||result.status==='conflict')changed()
            return result
        }catch(e){setMessage(explainError(e));return null}
        finally{setPending(false)}
    }
    function navigate(targetBoard:Board,targetId:string) {
        if(dirty && !confirm('Відкинути незбережені зміни й перейти до іншої картки?'))return
        const p=new URLSearchParams(params.toString());p.set('tab',targetBoard);p.delete('review');p.delete('delivery');p.delete('action');p.set(targetBoard==='review'?'review':'delivery',targetId)
        router.push(`/zhezhemon/processing?${p}`,{scroll:false})
    }
    const view=data?.view, raw=data?.snapshot?.raw_payload ?? {}, normalized=data?.snapshot?.normalized_payload ?? {}
    return <div className={styles.overlay} onMouseDown={e=>{if(e.target===e.currentTarget)close()}}>
        <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="card-title" ref={dialog}>
            <div className={styles.heading}><span>{board==='review'?'Оцінка оголошення':'Конкретне повідомлення'}</span><button ref={closeButton} onClick={close}>Закрити ×</button></div>
            {error && <p role="alert" className={styles.error}>{error}</p>}
            <button onClick={()=>setRefresh(v=>v+1)}>Оновити картку</button>
            {!data ? <h2 id="card-title">Завантаження картки…</h2>:<>
                <h2 id="card-title">{data.card.title}</h2>
                <p><a href={safeListing(normalized.itemWebUrl,data.card.link)} target="_blank" rel="noopener noreferrer">Відкрити на eBay ↗</a></p>
                <section>
                    <h3>{board==='review'?'Рішення стосується першого доставленого повідомлення':'Результат цього повідомлення'}</h3>
                    <p>{dateLabel(data.card.sent_at)} · {data.card.channel==='main'?'основний чат':'sniper'} · {searchLabel(data.card)}</p>
                    <p>{view?.outcome?outcomeLabels[view.outcome]:'Результату немає'}{view?.resolutionKind && view.resolutionKind!=='direct'?` · ${view.resolutionKind==='shared_trigger'?'через пов’язане повідомлення':'через подію'}`:''}</p>
                    <p className={styles.muted}>Перша пряма реакція: {dateLabel(view?.firstReactionAt ?? null)}. Результат: {dateLabel(view?.outcomeAt ?? null)}.</p>
                    <p className={styles.muted}>Час до першої реакції: {reactionDelay(data.card.sent_at,view?.firstReactionAt ?? null)}. Це календарний час, без нормативу SLA.</p>
                    {message && <p role="status" className={styles.error}>{message}</p>}
                    <div className={styles.actions}>
                        <button disabled={pending || !context} onClick={()=>run('set_like',{value:!view?.live.liked})}>{view?.live.liked?'Зняти лайк':'Лайк'}</button>
                        <button disabled={pending || !context} onClick={()=>run('hide')}>Приховати до подешевшання</button>
                        {PAUSE_DAYS.map(days=><button key={days} disabled={pending || !context} onClick={()=>run('pause',{days})}>Пауза {days}д</button>)}
                        <button disabled={pending || !context || !view?.searchExists} onClick={()=>run('ban')}>Бан у цьому пошуку</button>
                    </div>
                    {view && <Link href={`/sniper?${new URLSearchParams({link:data.card.link,ctx:tokenFromDispatchId(view.dispatchId)})}`} onClick={e=>{if(dirty && !confirm('Відкинути незбережену оцінку й перейти до Sniper?'))e.preventDefault()}}>Налаштувати Sniper для цього повідомлення</Link>}
                    {view && <OutcomeForm target={{kind:'delivery',deliveryId:data.card.delivery_id}} current={{outcome:view.outcome,firstReactionAt:view.firstReactionAt,hidden:!!view.live.hidden,bannedInSearch:view.live.bannedInSearch}} execute={run} locked={pending || !context} initialAction={params.get('action')}/>}
                </section>
                <section><h3>Поточний стан — окремо від історичного рішення</h3>
                    <p>{view?.live.hidden?`Приховано${view.live.hiddenUntil?' до '+dateLabel(view.live.hiddenUntil):' до подешевшання'}`:'Немає глобального приховування'}{view?.live.bannedInSearch?' · бан у цьому пошуку':''}{view?.live.stockBlocked?' · недоступне':''}{view?.live.favorite?' · Sniper':''}</p>
                    <p>Ціна повідомлення: {data.card.price ?? 'невідома'} {data.card.currency ?? ''}. Остання відома: {view?.currentPrice ?? 'невідома'}.</p>
                </section>
                <section><h3>Зафіксовані дані для оцінювання</h3>
                    <p className={styles.muted}>{data.snapshot?`${data.snapshot.source} · спостереження ${dateLabel(data.snapshot.observed_at)}`:'Знімок недоступний'}. Відкриття та реакції не викликають getItem.</p>
                    <p>📦 Залишок за знімком (оцінка eBay): {stockLabel(data.card.stock_quantity)}</p>
                    <p className={styles.muted}>Час спостереження: {dateLabel(data.card.stock_observed_at)}. Це історичні дані, не поточний залишок.</p>
                    <details><summary>Вихідні дані наявності</summary><pre>{json(normalized.estimatedAvailabilities ?? raw.estimatedAvailabilities)}</pre></details>
                    <details open><summary>Магазин і відгуки</summary><pre>{json(raw.seller ?? {seller:normalized.seller_name,feedbackScore:normalized.feedback_score,feedbackPercentage:normalized.feedback_percentage})}</pre></details>
                    <details open><summary>Параметри</summary><pre>{raw.localizedAspects?json(raw.localizedAspects):'Даних немає'}</pre></details>
                    <details open><summary>Опис (безпечний текст джерела)</summary><pre>{String(raw.description ?? raw.shortDescription ?? normalized.shortDescription ?? 'Даних немає')}</pre></details>
                    <details><summary>Ціна, доставка й пошуковий коридор</summary><pre>{json({price:normalized.price,shipping:normalized.shipping_cost,total:normalized.total_price,currency:normalized.currency,min:data.search.minprice,max:data.search.maxprice})}</pre></details>
                    <PhotoGallery photos={data.photos}/>
                    <details><summary>Збережені вихідні дані</summary><pre>{json(raw)}</pre></details>
                </section>
                {board==='review' && data.review && <AssessmentForm review={data.review} decisions={data.history.reactions} photos={data.photos} missingSources={data.missingSources} onSaved={changed} onDirty={setDirty}/>}
                {board==='notifications' && data.review && <button onClick={()=>navigate('review',data.review!.id)}>Відкрити навчальну оцінку цього лінка</button>}
                {!!data.revisions.length && <section><h3>Попередні версії оцінки</h3>{data.revisions.map(r=><details key={r.version}><summary>v{r.version} · {dateLabel(r.recorded_at)} · {r.reason}</summary><pre>{json(r.payload)}</pre></details>)}</section>}
                <section><h3>Повідомлення цього оголошення</h3><p className={styles.muted}>Останні 100. Повна вибірка — на дошці з фільтром лінка.</p>
                    <div className={styles.tableScroll}><table><thead><tr><th>Час</th><th>Чат</th><th>Перейти</th></tr></thead><tbody>{data.history.deliveries.map(d=><tr key={d.id}><td>{dateLabel(d.telegram_sent_at)}</td><td>{d.channel}</td><td><button disabled={d.id===data.card.delivery_id && board==='notifications'} onClick={()=>navigate('notifications',d.id)}>Повідомлення</button></td></tr>)}</tbody></table></div>
                    <Link href={`/zhezhemon/processing?${new URLSearchParams({tab:'notifications','notifications.link':data.card.link})}`}>Усі повідомлення цього лінка</Link>
                </section>
                <ReactionHistory key={`${data.card.link}-${refresh}`} link={data.card.link}/>
            </>}
        </div>
    </div>
}
