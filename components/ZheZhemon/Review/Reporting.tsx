'use client'
import {useEffect,useRef,useState} from 'react'
import {dateLabel,type Board} from '@/lib/reviewBoards'
import {durationLabel,validateExportPage,type Statistics,type ExportManifest,type ExportPage} from '@/lib/reviewReporting'
import {outcomeLabels} from '@/lib/reviewKeyboard'
import styles from './Boards.module.css'

async function checked(response:Response) {
    if(!response.ok) {
        if(response.status===401)throw new Error('Сесія закінчилась. Увійди знову.')
        if(response.status===422)throw new Error('Експорт застарів або його параметри змінились. Почни новий.')
        throw new Error('Звіт недоступний. Перевір запуск сервера й міграцій або спробуй ще раз.')
    }
    return response.json()
}
export default function Reporting({board,query,refresh}:{board:Board;query:string;refresh:number}) {
    const [open,setOpen]=useState(false),[stats,setStats]=useState<Statistics|null>(null),[error,setError]=useState('')
    const [threshold,setThreshold]=useState(''),[appliedThreshold,setAppliedThreshold]=useState(''),[retry,setRetry]=useState(0)
    const [busy,setBusy]=useState(false),[progress,setProgress]=useState(''),[exportId,setExportId]=useState<string|null>(null)
    const exportAbort=useRef<AbortController|null>(null)
    useEffect(()=>()=>exportAbort.current?.abort(),[])
    useEffect(()=>{
        if(!open || board!=='notifications')return
        const abort=new AbortController();setError('');setStats(null)
        const p=new URLSearchParams(query);p.set('report','statistics');if(appliedThreshold)p.set('threshold',String(Number(appliedThreshold)*60))
        fetch(`/api/review/reporting?${p}`,{signal:abort.signal,cache:'no-store'}).then(checked).then(setStats)
            .catch(e=>{if(!abort.signal.aborted)setError(e.message)})
        return ()=>abort.abort()
    },[open,board,query,refresh,appliedThreshold,retry])
    async function download() {
        if(busy)return
        const id=exportId ?? crypto.randomUUID();setExportId(id);setBusy(true);setError('');setProgress('Фіксую склад вибірки…')
        const abort=new AbortController();exportAbort.current=abort
        try {
            const manifest:ExportManifest=await fetch('/api/review/reporting',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,query}),signal:abort.signal}).then(checked)
            const lines=[JSON.stringify({type:'manifest',schemaVersion:1,...manifest})+'\n'];let after=0,bytes=0
            do {
                const page:ExportPage=await fetch(`/api/review/reporting?${new URLSearchParams({report:'export',id,after:String(after)})}`,{signal:abort.signal,cache:'no-store'}).then(checked)
                after=validateExportPage(manifest,after,page)
                const chunk=page.rows.map(row=>JSON.stringify({type:'training_example',...row})+'\n').join('')
                bytes+=new TextEncoder().encode(chunk).length
                if(bytes>100*1024*1024)throw new Error('Вибірка перевищує 100 МіБ. Звузь фільтри; частковий файл не збережено.')
                lines.push(chunk);setProgress(`Завантажено ${after} із ${manifest.row_count}`)
                if(page.complete)break
            }while(!abort.signal.aborted)
            if(abort.signal.aborted)return
            lines.push(JSON.stringify({type:'complete',exportId:id,rows:after})+'\n')
            const url=URL.createObjectURL(new Blob(lines,{type:'application/x-ndjson;charset=utf-8'})),a=document.createElement('a')
            a.href=url;a.download=`zhezhemon-training-${id}.jsonl`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000)
            setProgress(`Готово: ${after} оцінок. Виключено незавершених / непридатних: ${manifest.excluded_count}. Зріз: ${dateLabel(manifest.created_at)}.`)
        }catch(e){if(!abort.signal.aborted){setError(e instanceof Error && e.message==='incomplete_export'?'Неповна або неузгоджена відповідь. Файл не збережено; повтори експорт.':e instanceof Error?e.message:'Помилка експорту');setProgress('')}}
        finally{if(!abort.signal.aborted)setBusy(false)}
    }
    const s=stats?.summary
    return <details className={styles.reporting} open={open} onToggle={e=>setOpen(e.currentTarget.open)}>
        <summary>{board==='review'?'Експорт навчальних оцінок':'Аналітика сповіщень'}</summary>
        {board==='review'?<>
            <p className={styles.muted}>Уся вибірка за фільтрами вище, не лише завантажені картки. Лише здані придатні оцінки condition 1000 зі знімком не пізніше рішення. JSONL містить знімки, критерії та окрему мітку рішення. Хеші, статус і час архівації фото відокремлено від навчальних ознак; самих файлів фото немає.</p>
            <p className={styles.muted}>Повтор використовує той самий зріз протягом 24 годин. Для свіжої вибірки натисни «Новий зріз». Файл зберігається лише після перевірки всіх сторінок (до 100 МіБ).</p>
            <div className={styles.actions}><button disabled={busy} onClick={download}>{exportId?'Повторити експорт JSONL':'Експорт JSONL'}</button>{exportId && <button disabled={busy} onClick={()=>{setExportId(null);setProgress('');setError('')}}>Новий зріз</button>}</div>
            {progress && <p role="status">{progress}</p>}
        </>:<>
            <p className={styles.muted}>Усі доставки за фільтрами вище. Період — час відправлення; результати — поточні. Час календарний, лише прямі реакції закупщика. Це не оцінка втрачених одиниць чи прибутку.</p>
            <form className={styles.filters} onSubmit={e=>{e.preventDefault();setAppliedThreshold(threshold);setRetry(v=>v+1)}}><label>Поріг реакції, хв (необов’язково)<input type="number" min="1" max="525600" step="1" value={threshold} onChange={e=>setThreshold(e.target.value)}/></label><button>Перерахувати</button></form>
            {!stats && !error && open && <p role="status">Обчислюю повну вибірку…</p>}
            {stats && s && <>
                <p className={styles.muted}>Розраховано: {dateLabel(stats.generatedAt)}</p>
                <dl className={styles.metrics}>{[['deliveries','Доставки'],['events','Події'],['triggers','Тригери'],['links','Унікальні лінки'],['without_attention','Без уваги'],['without_outcome','Без результату'],['shared','Закрито через інше повідомлення'],['event_context','Закрито через подію']].map(([key,label])=><div key={key}><dt>{label}</dt><dd>{s[key] ?? '—'}</dd></div>)}</dl>
                <div className={styles.tableScroll}><table className={styles.technical}><thead><tr><th>Календарний час</th><th>Вимірів</th><th>Медіана</th><th>p90</th></tr></thead><tbody>
                    <tr><td>До першої прямої реакції</td><td>{s.direct_samples}</td><td>{durationLabel(s.reaction_median_seconds)}</td><td>{durationLabel(s.reaction_p90_seconds)}</td></tr>
                    <tr><td>До першого прямого рішення</td><td>{s.decision_samples}</td><td>{durationLabel(s.decision_median_seconds)}</td><td>{durationLabel(s.decision_p90_seconds)}</td></tr>
                </tbody></table></div>
                <p>Найстаріше без результату: {durationLabel(s.oldest_pending_seconds)}. Аномалій часу: {s.clock_anomalies}.</p>
                {stats.thresholdSeconds!==null && <p>Реакція до {durationLabel(stats.thresholdSeconds)}: {s.reacted_within_threshold} із {s.direct_samples} виміряних прямих реакцій ({s.deliveries} доставок загалом). Без реакції — не нульовий час.</p>}
                <p>«Купив би, не встиг» за словами закупщика: {s.missed_deliveries} доставок / {s.missed_triggers} тригерів / {s.missed_links} лінків. Із цих лінків пізніше позначено «Купив»: {s.missed_links_later_bought}.</p>
                <details><summary>Причини пропусків і помилок</summary><div className={styles.tableScroll}><table className={styles.technical}><thead><tr><th>Результат / причина</th><th>Доставки</th><th>Тригери</th><th>Лінки</th></tr></thead><tbody>{stats.reasons.map((r,i)=><tr key={i}><td>{outcomeLabels[r.outcome]} · {r.reason_code || 'Не зазначено'}</td><td>{r.deliveries}</td><td>{r.triggers}</td><td>{r.links}</td></tr>)}</tbody></table></div></details>
                <details><summary>За типом події та condition</summary><div className={styles.tableScroll}><table className={styles.technical}><thead><tr><th>Тип / condition</th><th>Доставки</th><th>Прямі реакції</th><th>Медіана / p90</th></tr></thead><tbody>{stats.breakdown.map((r,i)=><tr key={i}><td>{r.kind} / {r.condition_id ?? 'Невідомо'}</td><td>{r.deliveries}</td><td>{r.direct_samples}</td><td>{durationLabel(r.median_seconds)} / {durationLabel(r.p90_seconds)}</td></tr>)}</tbody></table></div></details>
            </>}
        </>}
        {error && <p role="alert" className={styles.error}>{error}</p>}
    </details>
}
