'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useReviewAction } from '@/components/ZheZhemon/Review/useReviewAction'
import { bugTypes, missedReasons, type ManualOutcome, type ReviewAction, type ReviewPayload, type ReviewCommandResult } from '@/lib/reviewCommands'
import type { ReviewTarget } from '@/lib/reviewClient'
import styles from './Review.module.css'

const outcomeLabels: Record<ManualOutcome, string> = {
    bought: '✅ Купив', would_buy_missed: '⏱ Не встиг', would_hide: '🙈 Приховав би', bug: '🐞 Баг',
}
const reasonLabels: Record<string, string> = {
    sold_out: 'Розкупили', price_changed: 'Ціна змінилась', limit_or_funds: 'Ліміт / кошти', other: 'Інша причина',
    selection_error: 'Помилка відбору', technical_duplicate: 'Технічний дубль', already_unavailable: 'Уже недоступний',
}

type Props = {
    target: ReviewTarget
    /** Current outcome of this exact message/event, if any. */
    current: { outcome: string | null; firstReactionAt: string | null; hidden: boolean; bannedInSearch: boolean | null }
    initialAction?: string | null
    execute?: (action: ReviewAction, payload?: ReviewPayload) => Promise<ReviewCommandResult | null>
    locked?: boolean
}

/**
 * Manual outcomes and live corrections for one notification (delivery or
 * event context). A submitted outcome is a new reaction that supersedes the
 * previous one; clearing needs a reason and never undoes hide/ban itself.
 */
export default function OutcomeForm({ target, current, initialAction, execute, locked }: Props) {
    const router = useRouter()
    const defaultAction = useReviewAction(target)
    const run = execute ?? defaultAction.run
    const pending = locked || defaultAction.pending
    const [mode, setMode] = useState<'outcome' | 'clear'>(initialAction === 'clear' ? 'clear' : 'outcome')
    const [outcome, setOutcome] = useState<ManualOutcome>(initialAction === 'bug' ? 'bug' : initialAction === 'missed' ? 'would_buy_missed' : 'bought')
    const [reason, setReason] = useState<string>(initialAction === 'missed' ? 'other' : '')
    const [note, setNote] = useState('')
    const [clearReason, setClearReason] = useState('')

    const needsReason = outcome === 'would_buy_missed' || outcome === 'bug'
    const needsNote = outcome === 'bug' || (outcome === 'would_buy_missed' && reason === 'other')
    const reasons = outcome === 'bug' ? bugTypes : missedReasons

    const submit = async () => {
        let result
        if (mode === 'clear') {
            if (!clearReason.trim()) return
            result = await run('clear_outcome', { reason: clearReason.trim() })
        } else {
            if (needsReason && !reason) return
            if (needsNote && !note.trim()) return
            result = await run('set_outcome', {
                value: outcome, ...(needsReason ? { reason } : {}), ...(note.trim() ? { note: note.trim() } : {}),
            })
        }
        if (result && (result.status === 'applied' || result.status === 'noop')) { setNote(''); setClearReason(''); router.refresh() }
        else if (result?.status === 'conflict') router.refresh()
    }

    return (
        <div className={styles.outcome_form}>
            <div className={styles.row}>
                {!current.firstReactionAt && target.kind!=='listing' && (
                    <button disabled={!!pending} onClick={() => run('review_ack').then(() => router.refresh())}>🖐 Опрацьовую</button>
                )}
                {current.hidden && <button disabled={!!pending} onClick={() => run('unhide').then(() => router.refresh())}>👁 Показати знову</button>}
                {current.bannedInSearch && <button disabled={!!pending} onClick={() => run('unban').then(() => router.refresh())}>♻️ Зняти бан</button>}
            </div>
            <div className={styles.row}>
                <label><input type="radio" checked={mode === 'outcome'} onChange={() => setMode('outcome')} /> {current.outcome ? 'Змінити результат' : 'Результат'}</label>
                {current.outcome && <label><input type="radio" checked={mode === 'clear'} onChange={() => setMode('clear')} /> Скинути помилковий результат</label>}
            </div>
            {mode === 'outcome' ? (
                <>
                    <div className={styles.row}>
                        {(Object.keys(outcomeLabels) as ManualOutcome[]).map(value => (
                            <label key={value}><input type="radio" name="outcome" checked={outcome === value} onChange={() => { setOutcome(value); setReason('') }} /> {outcomeLabels[value]}</label>
                        ))}
                    </div>
                    {needsReason && (
                        <div className={styles.row}>
                            {reasons.map(value => (
                                <label key={value}><input type="radio" name="reason" checked={reason === value} onChange={() => setReason(value)} /> {reasonLabels[value] ?? value}</label>
                            ))}
                        </div>
                    )}
                    <textarea value={note} onChange={e => setNote(e.target.value)} maxLength={4000} rows={3}
                        placeholder={needsNote ? 'Пояснення (обов’язково)' : 'Коментар (необов’язково)'} />
                    <button disabled={!!pending || (needsReason && !reason) || (needsNote && !note.trim())} onClick={submit}>
                        {pending ? 'Записую…' : current.outcome ? 'Записати виправлення' : 'Записати результат'}
                    </button>
                </>
            ) : (
                <>
                    <textarea value={clearReason} onChange={e => setClearReason(e.target.value)} maxLength={1000} rows={2}
                        placeholder="Причина скидання (обов’язково). Приховування/бан це не знімає." />
                    <button disabled={!!pending || !clearReason.trim()} onClick={submit}>{pending ? 'Скидаю…' : 'Скинути результат'}</button>
                </>
            )}
        </div>
    )
}
