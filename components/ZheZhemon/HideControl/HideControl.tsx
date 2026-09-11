'use client'

import { Eye, EyeOff, Loader } from 'lucide-react'
import { PAUSE_DAYS } from '@/lib/reviewCommands'
import type { ReviewAction, ReviewCommandResult, ReviewSource } from '@/lib/reviewCommands'
import type { ReviewTarget } from '@/lib/reviewClient'
import { useReviewAction } from '@/components/ZheZhemon/Review/useReviewAction'
import styles from './HideControl.module.css'

/**
 * Hiding, as buttons that each do their whole job in one tap.
 *
 * Every button completes one explicit intent (hide / unhide / pause N days)
 * through the command API. Nothing is toggled optimistically: the icon only
 * changes when the server projection comes back through realtime, and an
 * error leaves the card exactly as it was.
 *
 * The pair is exported separately so each caller can place them itself - the
 * card puts the durations on their own row of the strip, the toast on its own
 * line - and nothing has to be reordered around a component that renders both.
 */

/** Hide until it gets cheaper, or bring it back. */
type Feedback = { onResult?: (action: ReviewAction, result: ReviewCommandResult) => void }

export function HideButton({ target, hidden, source = 'dashboard', onResult }:
    { target: ReviewTarget; hidden: boolean; source?: ReviewSource } & Feedback) {
    const { run, pending } = useReviewAction(target, source)
    const busy = pending === 'hide' || pending === 'unhide'
    const action: ReviewAction = hidden ? 'unhide' : 'hide'
    return (
        <button
            className={styles.btn}
            disabled={!!pending}
            onClick={() => run(action).then(result => result && onResult?.(action, result))}
            title={hidden ? 'Показати знову' : 'Сховати, поки не подешевшає'}
        >
            {busy ? <Loader size={14} color="yellow" /> : hidden ? <Eye size={14} color="yellow" /> : <EyeOff size={14} color="yellow" />}
        </button>
    )
}

/** Set aside for a fixed stretch, whatever the price does meanwhile. */
export function PauseButtons({ target, source = 'dashboard', onResult }:
    { target: ReviewTarget; source?: ReviewSource } & Feedback) {
    const { run, pending } = useReviewAction(target, source)
    return (
        <>
            {PAUSE_DAYS.map((days) => (
                <button
                    key={days}
                    className={`${styles.btn} ${styles.pause}`}
                    disabled={!!pending}
                    onClick={() => run('pause', { days }).then(result => result && onResult?.('pause', result))}
                    title={`Пауза на ${days} дн. — повернеться за розкладом, хоч би що сталося з ціною`}
                >
                    {days}д
                </button>
            ))}
        </>
    )
}
