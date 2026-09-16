'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { stages, tabFilters, dateLabel, searchLabel, type Board, type BoardPage, type BoardCard, type Stage } from '@/lib/reviewBoards'
import { outcomeLabels } from '@/lib/reviewKeyboard'
import { stockLabel } from '@/lib/reviewStock'
import CardPanel from './CardPanel'
import TileActions from './TileActions'
import Reporting from './Reporting'
import styles from './Boards.module.css'
import {useReviewRealtime} from './useReviewRealtime'

const labels:Record<Board,Record<Stage,string>>={review:{new:'Нові',working:'Оброблено',done:'Оцінено'},notifications:{new:'Нові',working:'В роботі',done:'Оброблено'}}
export const eventLabels:Record<string,string>={first_seen:'Перша поява',returned:'Повернення',price_drop:'Подешевшання',pause_over:'Після паузи',sniper_target:'Sniper',availability_restored:'Знову доступно'}
async function load(query:URLSearchParams, signal?:AbortSignal):Promise<BoardPage> {
    const response=await fetch(`/api/review/boards?${query}`,{signal,cache:'no-store'})
    if(response.status===401){location.href=`/login?next=${encodeURIComponent(location.pathname+location.search)}`;throw new Error('Потрібен вхід')}
    if(!response.ok) { const e=await response.json();throw new Error(e.error==='disabled'?'Канбани ще не ввімкнено на сервері. Потрібен узгоджений запуск міграцій і команд.':e.error==='invalid_filters'?'Перевір фільтри й діапазон дат.':'Не вдалося завантажити канбан. Спробуй оновити.') }
    return response.json()
}
async function reloadPage(query:URLSearchParams, previous:BoardPage|undefined, signal:AbortSignal):Promise<BoardPage> {
    const page=await load(query,signal)
    // Keep already loaded pages when a reaction moves a card. Closing the panel
    // must not throw a buyer who loaded 150 rows back to the first 50.
    for(;;){
        const needed=stages.filter(stage=>page.columns[stage].cards.length<Math.min(previous?.columns[stage].cards.length ?? 0,page.columns[stage].count))
        if(!needed.length)return page
        const next=new URLSearchParams(query)
        for(const stage of needed){const last=page.columns[stage].cards.at(-1);if(last){next.set(`${stage}At`,last.card_at);next.set(`${stage}Id`,last.id)}}
        const extra=await load(next,signal);let added=0
        for(const stage of needed){const ids=new Set(page.columns[stage].cards.map(c=>c.id));const rows=extra.columns[stage].cards.filter(c=>!ids.has(c.id));added+=rows.length;page.columns[stage].cards.push(...rows);page.columns[stage].count=extra.columns[stage].count}
        if(!added)return page
    }
}
export default function ProcessingBoards() {
    const router=useRouter(), search=useSearchParams(), url=search.toString()
    const board:Board=search.get('tab')==='notifications'?'notifications':'review'
    const id=search.get(board==='review'?'review':'delivery')
    const [pages,setPages]=useState<Partial<Record<Board,BoardPage>>>({})
    const [error,setError]=useState(''),[loading,setLoading]=useState(true),[refresh,setRefresh]=useState(0)
    const [more,setMore]=useState<Stage|null>(null)
    const [filtersOpen,setFiltersOpen]=useState(false)
    const [externalVersion,setExternalVersion]=useState(0)
    const scroll=useRef<Record<string,number>>({})
    const filterKey=(['review','notifications'] as const).map(b=>tabFilters(new URLSearchParams(url),b).toString()).join('|')
    const activeRequest=useRef('');activeRequest.current=board+'|'+filterKey+'|'+refresh
    const loadedPages=useRef(pages);loadedPages.current=pages
    const lastFilter=useRef(filterKey)
    useEffect(()=>{
        const abort=new AbortController();setLoading(true);setError('')
        const previous=lastFilter.current===filterKey?loadedPages.current:{};lastFilter.current=filterKey
        Promise.all((['review','notifications'] as const).map(async b=>[b,await reloadPage(tabFilters(new URLSearchParams(url),b),previous[b],abort.signal)] as const))
            .then(values=>setPages(Object.fromEntries(values))).catch(e=>{if(!abort.signal.aborted)setError(e.message)})
            .finally(()=>{if(!abort.signal.aborted)setLoading(false)})
        return ()=>abort.abort()
        // Card opening and tab switching must not reset pages/scroll.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    },[filterKey,refresh])
    const change=(params:URLSearchParams,action?:string)=>{params.delete('action');if(action)params.set('action',action);router.push(`/zhezhemon/processing?${params}`,{scroll:false})}
    function switchTab(tab:Board) {const p=new URLSearchParams(url);p.set('tab',tab);p.delete('review');p.delete('delivery');change(p)}
    function open(card:BoardCard,action?:'missed'|'bug') {const p=new URLSearchParams(url);p.set('tab',board);p.delete('review');p.delete('delivery');p.set(board==='review'?'review':'delivery',card.id);change(p,action)}
    function close() {const p=new URLSearchParams(url);p.delete('review');p.delete('delivery');change(p)}
    async function next(stage:Stage) {
        const cards=pages[board]?.columns[stage].cards, last=cards?.at(-1)
        if(!last || more)return
        setMore(stage)
        const requestKey=activeRequest.current
        const p=tabFilters(new URLSearchParams(url),board);p.set(`${stage}At`,last.card_at);p.set(`${stage}Id`,last.id)
        try {
            const page=await load(p)
            if(activeRequest.current!==requestKey)return
            setPages(all=>{const current=all[board];if(!current)return all
                const existing=current.columns[stage].cards, ids=new Set(existing.map(c=>c.id))
                return {...all,[board]:{...current,columns:{...current.columns,[stage]:{count:page.columns[stage].count,cards:[...existing,...page.columns[stage].cards.filter(c=>!ids.has(c.id))]}}}}
            })
        }catch(e){setError(e instanceof Error?e.message:'Помилка')}
        finally{setMore(null)}
    }
    const onChanged=useCallback(()=>setRefresh(v=>v+1),[])
    const onExternalChange=useCallback(()=>{setExternalVersion(v=>v+1);setRefresh(v=>v+1)},[])
    const realtimeStatus=useReviewRealtime(onExternalChange,loading)
    const query=tabFilters(new URLSearchParams(url),board).toString()
    const activeFilters=Array.from(search.entries()).filter(([k,v])=>k.startsWith(`${board}.`) && v && v!=='false').length
    return <main className={`${styles.workspace} ${styles.boardWorkspace}`}>
        <h1 className={styles.srOnly}>Опрацювання</h1>
        <div className={styles.toolbar}>
        <div className={styles.tabs} role="tablist" aria-label="Канбани">
            {(['review','notifications'] as const).map(b=><button key={b} role="tab" id={`tab-${b}`} aria-controls="board-panel" aria-selected={board===b} onClick={()=>switchTab(b)}>{b==='review'?'Оцінка оголошень':'Усі сповіщення'} · {pages[b]?.pending ?? '—'}</button>)}
        </div>
        <div className={styles.toolbarActions}>
            <button aria-expanded={filtersOpen} aria-controls="board-filters" onClick={()=>setFiltersOpen(v=>!v)}>Фільтри{activeFilters?` · ${activeFilters}`:''}</button>
            <button disabled={loading} onClick={onChanged}>Оновити</button>
            <span className={styles.liveStatus} data-status={realtimeStatus} role="status">{realtimeStatus==='live'?'Наживо':realtimeStatus==='fallback'?'Резервне оновлення':'Підключення…'}</span>
            {board==='review' && <Reporting key={board+'|'+query} board={board} query={query} refresh={refresh}/>}
        </div>
        </div>
        <div className={styles.controls}>
        <div id="board-filters" className={styles.filterPanel} hidden={!filtersOpen}>
        <form key={board+filterKey} className={styles.filters} onSubmit={e=>{
            e.preventDefault();const data=new FormData(e.currentTarget),p=new URLSearchParams(url)
            Array.from(p.keys()).filter(k=>k.startsWith(`${board}.`)).forEach(k=>p.delete(k))
            for(const [k,v] of data.entries())if(String(v).trim())p.set(`${board}.${k}`,['from','to'].includes(k)?new Date(String(v)).toISOString():String(v).trim())
            p.delete('review');p.delete('delivery');change(p)
        }}>
            <label>Лінк або заголовок<input name="link" maxLength={500} defaultValue={search.get(`${board}.link`) ?? ''}/></label>
            <label>Пошук<select name="search" defaultValue={search.get(`${board}.search`) ?? ''}>
                <option value="">Усі пошуки</option><option value="deleted">Видалені пошуки</option>
                {(pages[board]?.searches ?? []).map(s=><option key={s.id} value={s.id}>{s.name ?? 'Пошук'} · #{s.id}</option>)}
                {search.get(`${board}.search`) && search.get(`${board}.search`)!=='deleted' && !(pages[board]?.searches ?? []).some(s=>String(s.id)===search.get(`${board}.search`)) && <option value={search.get(`${board}.search`)!}>Пошук #{search.get(`${board}.search`)}</option>}
            </select></label>
            <label>Результат<select name="outcome" defaultValue={search.get(`${board}.outcome`) ?? ''}><option value="">Усі</option>{Object.entries(outcomeLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
            <label>Колонка<select name="stage" defaultValue={search.get(`${board}.stage`) ?? ''}><option value="">Усі</option>{stages.map(s=><option key={s} value={s}>{labels[board][s]}</option>)}</select></label>
            {(['from','to'] as const).map(k=>{const iso=search.get(`${board}.${k}`);const local=iso && Number.isFinite(Date.parse(iso))?new Date(new Date(iso).getTime()-new Date(iso).getTimezoneOffset()*60000).toISOString().slice(0,16):'';return <label key={k}>{k==='from'?'Від':'До (не включно)'}<input type="datetime-local" name={k} defaultValue={local}/></label>})}
            {board==='notifications' && <>
                <label>Тип<select name="kind" defaultValue={search.get(`${board}.kind`) ?? ''}><option value="">Усі</option>{Object.entries(eventLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
                <label>Чат<select name="channel" defaultValue={search.get(`${board}.channel`) ?? ''}><option value="">Усі</option><option value="main">Основний</option><option value="sniper">Sniper</option></select></label>
                <label>Condition ID<input name="condition" type="number" min={1} defaultValue={search.get(`${board}.condition`) ?? ''}/></label>
                <label className={styles.check}><input type="checkbox" name="withoutReview" value="true" defaultChecked={search.get(`${board}.withoutReview`)==='true'}/>Без навчальних карток</label>
            </>}
            <label className={styles.check}><input type="checkbox" name="needsReaction" value="true" defaultChecked={search.get(`${board}.needsReaction`)==='true'}/>{board==='review'?'Не оцінені':'Без результату'}</label>
            <button type="submit">Застосувати</button>
            <button type="button" onClick={()=>{const p=new URLSearchParams(url);Array.from(p.keys()).filter(k=>k.startsWith(`${board}.`)).forEach(k=>p.delete(k));change(p)}}>Скинути</button>
        </form>
        </div>
        {board==='notifications' && <Reporting key={board+'|'+query} board={board} query={query} refresh={refresh}/>}
        {error && <p role="alert" className={styles.error}>{error}</p>}
        {loading && <p role="status" className={styles.muted}>Оновлюю дошки…</p>}
        </div>
        <div id="board-panel" role="tabpanel" aria-labelledby={`tab-${board}`} className={styles.columns}>
            {stages.map(stage=>{const column=pages[board]?.columns[stage];return <section key={`${board}-${stage}`} className={styles.column} data-stage={stage}>
                <h2>{labels[board][stage]} <span>{column?.count ?? '—'}</span></h2>
                <div className={styles.stack} ref={node=>{if(node){const key=`${board}-${stage}-${filterKey}`;let value=scroll.current[key];if(value===undefined){try{value=Number(sessionStorage.getItem('review-scroll:'+key)) || 0}catch{value=0}}node.scrollTop=value}}} onScroll={e=>{const key=`${board}-${stage}-${filterKey}`,value=e.currentTarget.scrollTop;scroll.current[key]=value;try{sessionStorage.setItem('review-scroll:'+key,String(value))}catch{/* storage may be disabled */}}}>
                    {column?.cards.map(card=><article key={card.id} className={styles.tile}>
                        <button className={styles.tileOpen} onClick={()=>open(card)}>
                        <strong>{card.title}</strong><span className={styles.price}>{card.price===null?'Ціна невідома':`${card.price} ${card.currency ?? ''}`}</span>
                        <span className={styles.muted}>📦 {stockLabel(card.stock_quantity)} · за знімком</span>
                        <span className={styles.tags}><span>{card.channel==='main'?'Основний чат':'Sniper'}</span><span>{eventLabels[card.kind] ?? card.kind}</span></span>
                        <span className={styles.muted}>{dateLabel(card.sent_at)} · {searchLabel(card)}</span>
                        <span>{card.outcome?outcomeLabels[card.outcome]:'Рішення ще немає'}</span>
                        {board==='review'?<span className={styles.muted}>Не заповнено критеріїв: {card.missing}/6</span>:<span className={styles.muted}>{card.first_reaction_at?`Перша реакція: ${dateLabel(card.first_reaction_at)}`:'Прямої реакції немає'}{card.resolution_kind && card.resolution_kind!=='direct'?` · ${card.resolution_kind==='shared_trigger'?'через пов’язане повідомлення':'через подію'}`:''}</span>}
                        <span className={styles.muted}>Зараз: {card.stock_blocked?'недоступне':card.hidden?`приховано${card.hidden_until?' / пауза':''}`:'без глобального приховування'}{card.favorite?' · Sniper':''}</span>
                        </button>
                        {/* Quick reactions only while the message has no result; done cards are edited in the panel. */}
                        {!card.outcome && <TileActions card={card} onChanged={onChanged} onOpen={action=>open(card,action)}/>}
                    </article>)}
                    {column?.count===0 && !loading && <p className={styles.empty}>Карток немає</p>}
                    {!!column && column.cards.length<column.count && <button disabled={!!more || loading} onClick={()=>next(stage)}>{more===stage?'Завантажую…':'Ще 50'}</button>}
                </div>
            </section>})}
        </div>
        {id && <CardPanel key={`${board}-${id}`} board={board} id={id} externalVersion={externalVersion} onClose={close} onChanged={onChanged}/>}
    </main>
}
