'use client'
import {useEffect,useState} from 'react'
import {dateLabel} from '@/lib/reviewBoards'
import {outcomeLabels} from '@/lib/reviewKeyboard'
import type {ReactionPage} from '@/lib/reviewReporting'
import styles from './Boards.module.css'

export default function ReactionHistory({link}:{link:string}) {
    const [page,setPage]=useState<ReactionPage|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false)
    const [attempt,setAttempt]=useState(0)
    useEffect(()=>{
        const abort=new AbortController();setBusy(true);setError('')
        fetch(`/api/review/reporting?${new URLSearchParams({report:'history',link})}`,{signal:abort.signal,cache:'no-store'})
            .then(async response=>{if(!response.ok)throw new Error('Історія недоступна. Спробуй ще раз.');return response.json()})
            .then(setPage).catch(e=>{if(!abort.signal.aborted)setError(e.message)})
            .finally(()=>{if(!abort.signal.aborted)setBusy(false)})
        return ()=>abort.abort()
    },[link,attempt])
    async function next() {
        if(!page?.next || busy)return
        setBusy(true);setError('')
        try {
            const response=await fetch(`/api/review/reporting?${new URLSearchParams({report:'history',link,before:page.next.at,beforeId:page.next.id})}`,{cache:'no-store'})
            if(!response.ok)throw new Error('Не вдалося завантажити старіші дії.')
            const extra:ReactionPage=await response.json()
            setPage(current=>current?{...extra,rows:[...current.rows,...extra.rows.filter(r=>!current.rows.some(old=>old.id===r.id))]}:extra)
        }catch(e){setError(e instanceof Error?e.message:'Помилка')}
        finally{setBusy(false)}
    }
    return <section><h3>Історія реакцій · {page?.total ?? '—'}</h3>
        <p className={styles.muted}>Новіші дії зверху; виправлення не стирають попередніх рішень. Системні записи відокремлено від дій закупщика.</p>
        {error && <p role="alert">{error} <button onClick={()=>page?next():setAttempt(v=>v+1)} disabled={busy}>Повторити</button></p>}
        <div className={styles.tableScroll}><table><thead><tr><th>Коли</th><th>Дія / результат</th><th>Контекст</th></tr></thead><tbody>{page?.rows.map(r=><tr key={r.id}><td>{dateLabel(r.received_at)}</td><td>{r.action}{r.outcome?' · '+outcomeLabels[r.outcome]:''}<p>{r.reason_code} {r.note}</p>{r.supersedes_reaction_id && <small>Виправлення попереднього рішення</small>}</td><td>{r.actor_id==='system'?'Система':'Закупщик'} · {r.delivery_id?'повідомлення':r.event_id?'подія':'загалом'} · {r.source}</td></tr>)}</tbody></table></div>
        {busy && <p role="status">Завантажую історію…</p>}
        {page?.next && <button disabled={busy} onClick={next}>Старіші дії · ще 50</button>}
        {page && !page.next && !busy && <p className={styles.muted}>{page.rows.length?'Історію завантажено повністю.':'Реакцій ще немає.'}</p>}
    </section>
}
