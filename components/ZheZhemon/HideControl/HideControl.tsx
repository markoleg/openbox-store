'use client'

import { useEffect, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { PAUSE_DAYS, hideUntilCheaper, pauseFor, unhide } from '@/lib/hideActions'
import styles from './HideControl.module.css'

/**
 * Hiding, as buttons that each do their whole job in one tap.
 *
 * That is the point of the shape. Hiding a lot drops it out of the list at
 * once, so anything needing a second tap on the same card is unreachable: an
 * earlier version hid on the first tap and offered the durations afterwards,
 * on a card that had already gone. Every button here completes an intent, and
 * what happens to the card next stops mattering.
 *
 * The pair is exported separately so each caller can place them itself - the
 * card puts the durations on their own row of the strip, the toast on its own
 * line - and nothing has to be reordered around a component that renders both.
 */

/** Hide until it gets cheaper, or bring it back. */
export function HideButton({ link, hidden }: { link: string; hidden: boolean }) {
    // A toast never gets fresh props, so it tracks the flag itself; a card does,
    // hence the sync.
    const [isHidden, setIsHidden] = useState(hidden)
    useEffect(() => setIsHidden(hidden), [hidden])

    return (
        <button
            className={styles.btn}
            onClick={() => {
                setIsHidden(!isHidden)
                isHidden ? unhide(link) : hideUntilCheaper(link)
            }}
            title={isHidden ? 'Показати знову' : 'Сховати, поки не подешевшає'}
        >
            {isHidden ? <Eye size={14} color="yellow" /> : <EyeOff size={14} color="yellow" />}
        </button>
    )
}

/** Set aside for a fixed stretch, whatever the price does meanwhile. */
export function PauseButtons({ link }: { link: string }) {
    return (
        <>
            {PAUSE_DAYS.map((days) => (
                <button
                    key={days}
                    className={`${styles.btn} ${styles.pause}`}
                    onClick={() => pauseFor(link, days)}
                    title={`Пауза на ${days} дн. — повернеться за розкладом, хоч би що сталося з ціною`}
                >
                    {days}д
                </button>
            ))}
        </>
    )
}
