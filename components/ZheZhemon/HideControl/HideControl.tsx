'use client'

import { useEffect, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { PAUSE_DAYS, hideUntilCheaper, pauseFor, unhide } from '@/lib/hideActions'
import styles from './HideControl.module.css'

interface Props {
    link: string
    /** Whether the lot is hidden right now, per the row this renders from. */
    hidden: boolean
    /**
     * Called the moment the strip switches to the durations. The toast uses it
     * to stop its own countdown, since picking a day takes longer than the few
     * seconds a toast normally lives.
     */
    onExpand?: () => void
}

/**
 * The hide button, and the pause durations that replace the strip around it.
 *
 * The action strip is four icons on a card and two in a toast, laid out as a
 * 40px column on desktop and a full-width row on mobile. Adding four duration
 * buttons to either would stretch the card or squeeze the row, so the strip
 * *switches* instead of growing: a hidden lot shows the durations in place of
 * the other actions, one slot wider than before rather than four.
 *
 * That also makes the state readable at a glance - durations on screen mean the
 * lot is hidden - and matches how the same choice works in Telegram, where the
 * first tap hides and the second turns it into a pause.
 *
 * The trade-off: Ban and the rest are not reachable while a lot is hidden. They
 * come back when it does, and a hidden lot is one already decided against.
 */
export default function HideControl({ link, hidden, onExpand }: Props) {
    // Kept locally so a toast, which never re-renders from the database, still
    // switches when tapped. Cards do get fresh props, hence the sync.
    const [isHidden, setIsHidden] = useState(hidden)
    useEffect(() => setIsHidden(hidden), [hidden])

    if (!isHidden) {
        return (
            <button
                onClick={() => {
                    setIsHidden(true)
                    onExpand?.()
                    hideUntilCheaper(link)
                }}
                title="Сховати, поки не подешевшає"
            >
                <EyeOff size={14} color="yellow" />
            </button>
        )
    }

    return (
        <>
            <button
                onClick={() => {
                    setIsHidden(false)
                    unhide(link)
                }}
                title="Показати знову"
            >
                <Eye size={14} color="yellow" />
            </button>
            {PAUSE_DAYS.map((days) => (
                <button
                    key={days}
                    className={styles.pause}
                    onClick={() => pauseFor(link, days)}
                    title={`Пауза на ${days} дн. — повернеться за розкладом, хоч би що сталося з ціною`}
                >
                    {days}д
                </button>
            ))}
        </>
    )
}
