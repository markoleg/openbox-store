'use client'
import {useCallback,useEffect,useRef,useState} from 'react'
import {useRouter,useSearchParams} from 'next/navigation'
import {eventLabels,tabFilters,type BoardCard,type BoardPage,type Stage} from '@/lib/reviewBoards'
import type {ListingPhoto} from '@/lib/listingPhotos'
import {outcomeLabels} from '@/lib/reviewKeyboard'
import CardPanel from './CardPanel'
import NotificationTile from './NotificationTile'
import PhotoLightbox from './PhotoLightbox'
import {useReviewRealtime} from './useReviewRealtime'
import styles from './Boards.module.css'
async function load(query:URLSearchParams,signal?:AbortSignal):Promise<BoardPage>{
  const response=await fetch(`/api/review/boards?${query}`,{signal,cache:'no-store'});
  if(response.status===401){location.href=`/login?next=${encodeURIComponent(location.pathname+location.search)}`;throw new Error('Потрібен вхід')}
  if(!response.ok)throw new Error(response.status===503?'Черга недоступна. Перевір узгоджений запуск міграцій і команд.':'Не вдалося завантажити чергу.');return response.json();
}
export default function ProcessingBoards({stage='new'}:{stage?:Stage}){
  const router=useRouter(),search=useSearchParams(),url=search.toString(),path=stage==='new'?'/zhezhemon/processing':'/zhezhemon/processed';
  const query=tabFilters(new URLSearchParams(url),'notifications');query.set('stage',stage);const filterKey=query.toString(),id=search.get('card') ?? search.get('delivery');
  const [page,setPage]=useState<BoardPage|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[more,setMore]=useState(false),[refresh,setRefresh]=useState(0),[filtersOpen,setFiltersOpen]=useState(false),[externalVersion,setExternalVersion]=useState(0);
  const [gallery,setGallery]=useState<{photos:ListingPhoto[];title:string}|null>(null);
  const requestKey=filterKey+'|'+refresh;
  const loaded=useRef(page);loaded.current=page;const active=useRef(requestKey),lastFilter=useRef(filterKey);active.current=requestKey;
  const scroll=useRef<HTMLDivElement>(null),position=useRef<Record<string,number>>({});
  useEffect(()=>{
    const abort=new AbortController(),previous=lastFilter.current===filterKey?loaded.current:null;lastFilter.current=filterKey;setLoading(true);setError('');
    (async()=>{const result=await load(new URLSearchParams(filterKey),abort.signal);
      while(result.columns[stage].cards.length<Math.min(previous?.columns[stage].cards.length ?? 0,result.columns[stage].count)){
        const last=result.columns[stage].cards.at(-1);if(!last)break;const next=new URLSearchParams(filterKey);next.set(stage+'At',last.card_at);next.set(stage+'Id',last.id);
        const extra=await load(next,abort.signal),ids=new Set(result.columns[stage].cards.map(c=>c.id)),rows=extra.columns[stage].cards.filter(c=>!ids.has(c.id));if(!rows.length)break;result.columns[stage].cards.push(...rows);
      }
      if(!abort.signal.aborted)setPage(result);
    })().catch(e=>{if(!abort.signal.aborted)setError(e.message)}).finally(()=>{if(!abort.signal.aborted)setLoading(false)});
    return ()=>abort.abort();
  },[filterKey,stage,refresh]);
  useEffect(()=>{if(scroll.current)scroll.current.scrollTop=position.current[filterKey] ?? 0},[filterKey,loading]);
  const change=(params:URLSearchParams)=>router.push(`${path}?${params}`,{scroll:false});
  function open(card:BoardCard,action?:'bug'){const p=new URLSearchParams(url);p.delete('delivery');p.delete('action');p.set('card',card.id);if(action)p.set('action',action);change(p)}
  function close(){const p=new URLSearchParams(url);p.delete('card');p.delete('delivery');p.delete('action');change(p)}
  const onChanged=useCallback(()=>setRefresh(v=>v+1),[]),external=useCallback(()=>{setExternalVersion(v=>v+1);setRefresh(v=>v+1)},[]),live=useReviewRealtime(external,loading || more,stage==='new'?'polling':'realtime');
  async function next(){const last=page?.columns[stage].cards.at(-1);if(!last || more)return;setMore(true);const generation=requestKey;
    try{const q=new URLSearchParams(filterKey);q.set(stage+'At',last.card_at);q.set(stage+'Id',last.id);const extra=await load(q);if(active.current!==generation)return;
      setPage(current=>{if(!current)return current;const ids=new Set(current.columns[stage].cards.map(c=>c.id));return {...current,columns:{...current.columns,[stage]:{count:extra.columns[stage].count,cards:[...current.columns[stage].cards,...extra.columns[stage].cards.filter(c=>!ids.has(c.id))]}}}});
    }catch(e){setError(e instanceof Error?e.message:'Помилка')}finally{setMore(false)}
  }
  const column=page?.columns[stage];
  return <main className={`${styles.workspace} ${styles.boardWorkspace}`}>
    <div className={styles.toolbar}><h1>{stage==='new'?'Нові сповіщення':'Журнал оброблених'} · {column?.count ?? '—'}</h1><div className={styles.toolbarActions}><button onClick={()=>setFiltersOpen(v=>!v)} aria-expanded={filtersOpen}>Фільтри</button><button className={styles.refreshButton} disabled={loading || more} aria-busy={loading} onClick={onChanged}>{loading?'Оновлюю…':'Оновити'}</button><span className={styles.liveStatus} data-status={live}>{live==='polling'?'Кожні 30 с':live==='live'?'Наживо':live==='fallback'?'Резервне оновлення':'Підключення…'}</span></div></div>
    <div className={styles.controls}><div hidden={!filtersOpen} className={styles.filterPanel}>
      <form key={filterKey} className={styles.filters} onSubmit={e=>{e.preventDefault();const p=new URLSearchParams();for(const [key,value] of new FormData(e.currentTarget))if(String(value).trim())p.set('notifications.'+key,['from','to'].includes(key)?new Date(String(value)).toISOString():String(value).trim());change(p)}}>
        <label>Лінк або заголовок<input name="link" defaultValue={search.get('notifications.link') ?? ''}/></label>
        <label>Пошук<select name="search" defaultValue={search.get('notifications.search') ?? ''}><option value="">Усі</option><option value="deleted">Видалені</option>{page?.searches?.map(s=><option key={s.id} value={s.id}>{s.name ?? 'Пошук'} · #{s.id}</option>)}</select></label>
        {stage==='processed' && <label>Результат<select name="outcome" defaultValue={search.get('notifications.outcome') ?? ''}><option value="">Усі</option>{Object.entries(outcomeLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>}
        <label>Партійний<select name="partNumber" defaultValue={search.get('notifications.partNumber') ?? ''}><option value="">Усі</option><option value="missing">Без номера</option><option value="not_in_catalog">Немає в ERP</option></select></label>
        <label>Тип<select name="kind" defaultValue={search.get('notifications.kind') ?? ''}><option value="">Усі</option>{Object.entries(eventLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
        {(['from','to'] as const).map(k=>{const iso=search.get('notifications.'+k),local=iso && Number.isFinite(Date.parse(iso))?new Date(Date.parse(iso)-new Date(iso).getTimezoneOffset()*60000).toISOString().slice(0,16):'';return <label key={k}>{k==='from'?'Від':'До (не включно)'}<input name={k} type="datetime-local" defaultValue={local}/></label>})}
        <button>Застосувати</button><button type="button" onClick={()=>change(new URLSearchParams())}>Скинути</button>
      </form>
    </div>{error && <p role="alert" className={styles.error}>{error}</p>}</div>
    <div ref={scroll} className={styles.queue} onScroll={e=>{position.current[filterKey]=e.currentTarget.scrollTop}}>
      <div className={stage==='new'?styles.newQueue:styles.journal}>
        {column?.cards.map(card=><NotificationTile key={card.id} card={card} onChanged={onChanged} onOpen={action=>open(card,action)} onPhotos={photos=>setGallery({photos,title:card.title})}/>)}
      </div>
      {column?.count===0 && !loading && <p className={styles.empty}>Карток немає</p>}
      {column && column.cards.length<column.count && <button disabled={more || loading} onClick={next}>{more?'Завантажую…':'Ще 50'}</button>}
    </div>
    {id && <CardPanel key={id} board="notifications" id={id} externalVersion={externalVersion} onClose={close} onChanged={onChanged}/>}
    {gallery && <PhotoLightbox photos={gallery.photos} title={gallery.title} onClose={()=>setGallery(null)}/>}
  </main>
}
