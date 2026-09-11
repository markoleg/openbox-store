'use client'
import { useCallback, useState } from 'react'
import { toast } from 'react-toastify'
import type { ReviewAction, ReviewCommandResult, ReviewPayload, ReviewSource } from '@/lib/reviewCommands'
import { explainError, explainResult, runCommand, type ReviewTarget } from '@/lib/reviewClient'
import { usePatchLink } from '@/context/itemsContext'

/**
 * One buyer click → one command, with the result shown as it really was.
 * The UI never flips an icon before the server confirms; realtime updates of
 * items/scraped_links repaint the card afterwards.
 */
export function useReviewAction(target: ReviewTarget, source: ReviewSource = 'dashboard') {
    const [pending, setPending] = useState<ReviewAction | null>(null)
    const patchLink = usePatchLink()

    const run = useCallback(async (action: ReviewAction, payload: ReviewPayload = {},
        options: { quiet?: boolean; target?: ReviewTarget } = {}): Promise<ReviewCommandResult | null> => {
        if (pending) return null
        setPending(action)
        try {
            let { context, result } = await runCommand(options.target ?? target, action, payload, source)
            if (action === 'hide' && result.status === 'conflict' && result.reason === 'price_changed'
                && result.currentPrice !== undefined) {
                // The quoted price is stale. Hiding "below $old" when the lot already
                // costs less would fire at once, so the threshold is confirmed explicitly.
                if (confirm(`Ціна змінилась: $${result.contextPrice} → $${result.currentPrice}.\nСховати, поки не стане дешевше за $${result.currentPrice}?`)) {
                    // Any context knows its listing; the fresh listing context quotes the current price.
                    ;({ context, result } = await runCommand({ kind: 'listing', link: context.link }, 'hide', {}, source))
                } else {
                    return result
                }
            }
            if (result.live) {
                patchLink(context.link, { favorite: result.live.favorite ?? false, desired_price: result.live.desired_price,
                    hidden_until: result.live.hidden_until, ...(result.live.liked !== undefined && result.live.liked !== null ? { liked: result.live.liked } : {}) })
            }
            const { ok, text } = explainResult(action, result)
            if (!options.quiet || !ok) (ok ? toast.success : toast.warn)(text, { autoClose: 4000 })
            return result
        } catch (error) {
            toast.error(explainError(error), { autoClose: 6000 })
            return null
        } finally {
            setPending(null)
        }
    }, [target, source, pending, patchLink])

    return { run, pending }
}
