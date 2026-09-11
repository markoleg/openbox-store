'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Ban, Hand, ShoppingCart, Timer } from 'lucide-react'
import { HideButton, PauseButtons } from '@/components/ZheZhemon/HideControl/HideControl'
import { useReviewAction } from '@/components/ZheZhemon/Review/useReviewAction'
import { missedReasons } from '@/lib/reviewCommands'
import type { ReviewTarget } from '@/lib/reviewClient'

/** One row of notification_toasts: a causal event after the send decision. */
export type ToastEvent = {
    event_id: string
    link: string
    kind: string
    channel: string
    search_id: number | null
    availability: string | null
    summary: {
        title?: string; total_price?: number | string; shipping_cost?: number | string; condition?: string
        seller_name?: string; feedback_score?: number; feedback_percentage?: number; old_total?: number | string
        desired_price?: number | string; itemWebUrl?: string
    }
}

const kindLabels: Record<string, string> = {
    first_seen: 'NEW', returned: 'ПОВЕРНУЛОСЬ', price_drop: 'ЦІНА ↓', pause_over: 'ПАУЗА СКІНЧИЛАСЬ',
    availability_restored: 'ЗНОВУ ДОСТУПНИЙ', sniper_target: 'SNIPER 🎯',
}
const reasonLabels: Record<string, string> = {
    sold_out: 'Розкупили', price_changed: 'Ціна змінилась', limit_or_funds: 'Ліміт / кошти', other: 'Інша причина',
}

/**
 * The dashboard's view of a notification event. Actions carry the exact event
 * context (source=dashboard_toast, delivery unknown), so a decision made here
 * before Telegram delivers is "handled before send", never a negative SLA.
 * Clicking a button must not close the toast; a finished toast is closed
 * with its own close control.
 */
export default function ReviewToast({ event }: { event: ToastEvent }) {
    const target: ReviewTarget = { kind: 'event', eventId: event.event_id }
    const { run, pending } = useReviewAction(target, 'dashboard_toast')
    const [outcome, setOutcome] = useState<string | null>(null)
    const [acked, setAcked] = useState(false)
    const [missedOpen, setMissedOpen] = useState(false)
    const s = event.summary
    const total = s.total_price !== undefined ? Number(s.total_price).toFixed(2) : '?'
    const shipping = Number(s.shipping_cost ?? 0)
    const historyHref = `/zhezhemon/history?${new URLSearchParams({ event: event.event_id })}`

    const decide = async (action: 'set_outcome' | 'review_ack', payload: Record<string, unknown>, label: string) => {
        const result = await run(action, payload)
        if (!result || (result.status !== 'applied' && result.status !== 'noop')) return
        if (action === 'review_ack') setAcked(true)
        else setOutcome(label)
        setMissedOpen(false)
    }

    return (
        <div onClick={(e) => e.stopPropagation()}>
            <p>
                {kindLabels[event.kind] ?? event.kind}:{' '}
                <a href={s.itemWebUrl ?? event.link} target="_blank" rel="noopener noreferrer"
                    style={{ color: '#00d084', textDecoration: 'underline' }}>
                    {s.title ?? event.link}
                </a>
                <br />
                <b>{s.condition}</b>{' '}
                <span style={{ color: 'var(--primary)' }}>for <b>${total}</b></span>{' '}
                <span style={{ color: 'var(--bg-gray-o70)' }}>
                    {shipping > 0 ? `($${shipping} shipping)` : ''}
                    {s.old_total !== undefined ? ` було $${Number(s.old_total).toFixed(2)}` : ''}
                </span>
                <br />
                <span><b>{s.seller_name}</b> ({s.feedback_score}) {s.feedback_percentage}%</span>
                {event.availability && event.availability !== 'available' && (
                    <><br /><small>⚠️ Наявність не перевірена</small></>
                )}
            </p>
            {outcome ? (
                <p className="toast_result">
                    <b>{outcome}</b> · <Link href={historyHref}>Картка / історія</Link>
                </p>
            ) : (
                <>
                    <span className="toast_actions">
                        <button onClick={() => decide('review_ack', {}, 'В роботі')} disabled={!!pending || acked}
                            title={acked ? 'В роботі' : 'Опрацьовую'} className={acked ? 'acked' : ''}>
                            <Hand size={14} color={acked ? '#00d084' : 'yellow'} />
                        </button>
                        <button onClick={() => decide('set_outcome', { value: 'bought' }, '✅ Купив')} disabled={!!pending} title="Купив">
                            <ShoppingCart size={14} color="#00d084" />
                        </button>
                        <button onClick={() => { if (confirm('Забанити в пошуку цього повідомлення?')) run('ban').then(r => r?.status === 'applied' && setOutcome('🚫 Забанено')) }}
                            className="ban_btn" disabled={!!pending} title="Ban у пошуку">
                            <Ban size={14} color="red" />
                        </button>
                        <HideButton target={target} hidden={false} source="dashboard_toast"
                            onResult={(_, r) => r.status === 'applied' && setOutcome('🙈 Приховано до подешевшання')} />
                        <span className="toast_days">
                            <PauseButtons target={target} source="dashboard_toast"
                                onResult={(_, r) => r.status === 'applied' && setOutcome('⏸ Пауза')} />
                        </span>
                        <button onClick={() => setMissedOpen(v => !v)} disabled={!!pending} title="Не встиг">
                            <Timer size={14} color="orange" />
                        </button>
                    </span>
                    {missedOpen && (
                        <span className="toast_actions toast_reasons">
                            {missedReasons.map(reason => (
                                <button key={reason} disabled={!!pending}
                                    onClick={() => decide('set_outcome', { value: 'would_buy_missed', reason }, `⏱ Не встиг: ${reasonLabels[reason]}`)}>
                                    {reasonLabels[reason]}
                                </button>
                            ))}
                        </span>
                    )}
                    <p className="toast_links">
                        <Link href={historyHref}>Картка / історія</Link>
                        {' · '}
                        <Link href={`/sniper?${new URLSearchParams({ link: event.link, hint: `${s.condition ?? ''} [${s.seller_name ?? ''}] ${s.title ?? ''}`, event: event.event_id })}`}>Sniper</Link>
                    </p>
                </>
            )}
        </div>
    )
}
