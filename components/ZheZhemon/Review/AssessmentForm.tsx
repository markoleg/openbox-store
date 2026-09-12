'use client'
import { useEffect, useRef, useState } from 'react'
import { criteria, isSubmitted, type Assessment, type AssessmentRequest } from '@/lib/reviewBoards'
import { outcomeLabels } from '@/lib/reviewKeyboard'
import styles from './Boards.module.css'

type Decision = {id:string; outcome:string | null; received_at:string; delivery_id:string | null}
const fields=(review:Assessment) => Object.fromEntries([
    ...criteria.flatMap(([key]) => [[`score_${key}`,review[`score_${key}`]], [`note_${key}`,review[`note_${key}`] ?? '']]),
    ['decision_reaction_id',review.decision_reaction_id],['decision_note',review.decision_note ?? ''],['photo_notes',review.photo_notes],
])

export default function AssessmentForm({review,decisions,photos,missingSources,onSaved,onDirty}:{
    review:Assessment; decisions:Decision[]; photos:{source_url:string}[]; missingSources:string[]; onSaved:()=>void; onDirty:(dirty:boolean)=>void
}) {
    const [draft,setDraft]=useState<Record<string,unknown>>(()=>fields(review))
    const [version,setVersion]=useState(review.version)
    const [dirty,setDirty]=useState(false)
    const [busy,setBusy]=useState(false)
    const [error,setError]=useState('')
    const [reason,setReason]=useState('')
    const uncertain=useRef<AssessmentRequest | null>(null)
    const closed=isSubmitted(review)
    useEffect(()=>{ onDirty(dirty || !!uncertain.current) },[dirty,onDirty,busy])
    useEffect(()=>{
        if (!dirty && !uncertain.current) { setDraft(fields(review)); setVersion(review.version) }
    },[review,dirty])
    const set=(key:string,value:unknown)=>{ setDraft(current=>({...current,[key]:value})); setDirty(true) }
    const complete=criteria.every(([key])=>draft[`score_${key}`] && String(draft[`note_${key}`] ?? '').trim()) && !!draft.decision_reaction_id
    async function save(action:AssessmentRequest['action']) {
        if (busy) return
        setBusy(true); setError('')
        const body=uncertain.current ?? {commandId:crypto.randomUUID(),reviewId:review.id,version,action,payload:action==='reopen'?{reason}:draft}
        uncertain.current=body
        try {
            const response=await fetch('/api/review/assessments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
            if (response.status===401) { location.href=`/login?next=${encodeURIComponent(location.pathname+location.search)}`; return }
            const result=await response.json()
            if (response.ok) { uncertain.current=null; setDirty(false); setReason(''); onSaved() }
            else if (response.status===409) { uncertain.current=null; setError('Оцінку вже змінено в іншому місці. Твій текст збережений у формі. Онови картку й перенеси потрібні зміни.'); onSaved() }
            else if (response.status>=500) { setError('Сервер не підтвердив збереження. Повтори той самий запит кнопкою нижче.') }
            else { uncertain.current=null; setError(result.reason==='missing_sources'?'У знімку бракує даних для повної оцінки. Збережи чернетку.':'Не збережено. Потрібні шість балів, пояснення та явне рішення. Здану оцінку можна змінити лише через нову редакцію.') }
        } catch { setError('Немає підтвердження збереження. Повтори той самий запит — дубль не створиться.') }
        finally { setBusy(false) }
    }
    return <section className={styles.assessment}>
        <h3>Оцінка за шістьма критеріями · v{review.version}</h3>
        <p className={styles.muted}>1 — неприйнятно · 2 — суттєві ризики · 3 — із застереженнями · 4 — добре · 5 — дуже добре. Немає даних — залиш поле порожнім.</p>
        {error && <p className={styles.error} role="alert">{error}</p>}
        {!!missingSources.length && <p className={styles.error}>Неповні дані: {missingSources.map(k=>criteria.find(([key])=>key===k)?.[1] ?? k).join(', ')}. Можна зберегти чернетку, але не здати оцінку.</p>}
        {version!==review.version && dirty && <p className={styles.error}>На сервері нова версія. Застарілий текст не перезапише її.</p>}
        <fieldset disabled={closed || busy || !!uncertain.current}>
            {criteria.map(([key,label])=><fieldset key={key}>
                <legend>{label}</legend>
                <label>Бал<select aria-label={`${label}: бал`} value={String(draft[`score_${key}`] ?? '')} onChange={e=>set(`score_${key}`,e.target.value?Number(e.target.value):null)}>
                    <option value="">Не оцінено</option>{[1,2,3,4,5].map(v=><option key={v} value={v}>{v}</option>)}
                </select></label>
                <label>Пояснення<textarea aria-label={`${label}: пояснення`} rows={2} maxLength={4000} value={String(draft[`note_${key}`] ?? '')} onChange={e=>set(`note_${key}`,e.target.value)}/></label>
            </fieldset>)}
            {photos.map((photo,index)=><label key={photo.source_url}>Нотатка до фото {index+1} (необов’язково)<textarea rows={2} maxLength={2000}
                value={String((draft.photo_notes as Record<string,string>)?.[photo.source_url] ?? '')}
                onChange={e=>{const notes={...(draft.photo_notes as Record<string,string>)};if(e.target.value.trim())notes[photo.source_url]=e.target.value;else delete notes[photo.source_url];set('photo_notes',notes)}}/></label>)}
            <label>Рішення для навчальної оцінки<select value={String(draft.decision_reaction_id ?? '')} onChange={e=>set('decision_reaction_id',e.target.value || null)}>
                <option value="">Спочатку запиши результат вище</option>
                {decisions.filter(d=>d.outcome).map(d=><option key={d.id} value={d.id}>{outcomeLabels[d.outcome!] ?? d.outcome} · {new Date(d.received_at).toLocaleString('uk-UA')} · {d.delivery_id?'повідомлення':'оголошення загалом'}</option>)}
            </select></label>
            <label>Пояснення рішення<textarea rows={2} value={String(draft.decision_note ?? '')} maxLength={4000} onChange={e=>set('decision_note',e.target.value)}/></label>
        </fieldset>
        {closed ? <>
            <p>Оцінку здано. Подальші сповіщення не змінюють цю версію.</p>
            <label>Причина нової редакції<input value={reason} maxLength={1000} onChange={e=>setReason(e.target.value)} disabled={busy || !!uncertain.current}/></label>
            <button disabled={busy || !reason.trim() || !!uncertain.current} onClick={()=>save('reopen')}>Відкрити нову редакцію</button>
        </> : <div className={styles.actions}>
            <button disabled={busy || !dirty || !!uncertain.current} onClick={()=>save('draft')}>Зберегти чернетку</button>
            <button disabled={busy || !complete || !!uncertain.current || !!missingSources.length} onClick={()=>save('submit')}>Здати оцінку</button>
            {dirty && <span className={styles.muted}>Є незбережені зміни</span>}
        </div>}
        {uncertain.current && !busy && <button onClick={()=>save(uncertain.current!.action)}>Повторити непідтверджене збереження</button>}
        {dirty && version!==review.version && <button onClick={()=>{if(confirm('Відкинути локальні зміни та завантажити серверну версію?')) {setDirty(false);setDraft(fields(review));setVersion(review.version);setError('')}}}>Завантажити серверну версію</button>}
    </section>
}
