'use client'
import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/SupaBaseClient'
import { normalizeListingLink } from '@/lib/reviewCommands'
import { describeHide } from '@/lib/hideActions'
import { useReviewAction } from '@/components/ZheZhemon/Review/useReviewAction'
import type { ReviewTarget } from '@/lib/reviewClient'

/**
 * Where the legacy /api/hideItem and /api/banItem links land. Opening the page
 * changes nothing; the button applies one explicit command against the listing
 * (source=dashboard, no delivery), with the current state shown first.
 */
function ConfirmInner() {
    const params = useSearchParams()
    const action = params.get('action') === 'ban' ? 'ban' : 'hide'
    const rawLink = params.get('link') ?? ''
    const link = normalizeListingLink(rawLink)
    const searchId = Number(params.get('searchId'))
    const target: ReviewTarget = { kind: 'listing', link: link ?? '', ...(action === 'ban' && searchId > 0 ? { searchId } : {}) }
    const { run, pending } = useReviewAction(target)
    const [state, setState] = useState<{ hidden: boolean; hidden_until: string | null; price: number | null } | null | undefined>(undefined)
    const [search, setSearch] = useState<{ keywords: string; model: string | null; banned: string[] | null } | null>(null)
    const [done, setDone] = useState<string | null>(null)

    useEffect(() => {
        if (!link) { setState(null); return }
        supabase.from('scraped_links').select('hidden, hidden_until, price').eq('link', link).maybeSingle()
            .then(({ data }) => setState(data ?? null))
        if (action === 'ban' && searchId > 0) {
            supabase.from('searchparameters').select('keywords, model, banned').eq('id', searchId).maybeSingle()
                .then(({ data }) => setSearch(data ?? null))
        }
    }, [link, action, searchId])

    if (!link) return <p>Некоректне посилання на оголошення.</p>
    const alreadyBanned = !!search?.banned?.includes(link)
    return (
        <div>
            <h2>{action === 'ban' ? 'Забанити в пошуку' : 'Сховати до подешевшання'}</h2>
            <p><a href={link} target="_blank" rel="noopener noreferrer">{link}</a></p>
            {state === undefined ? <p>Завантаження…</p> : state === null
                ? <p>Оголошення невідоме трекеру — команда неможлива.</p>
                : <p>Зараз: {state.hidden ? `🙈 приховано ${describeHide(state.hidden_until)}` : 'видиме'}{state.price != null ? ` · поріг $${state.price}` : ''}</p>}
            {action === 'ban' && (search
                ? <p>Пошук: <b>{search.keywords} {search.model ?? ''}</b>{alreadyBanned ? ' · вже забанено' : ''}</p>
                : <p>Пошук #{searchId || '?'} не знайдено або видалений — бан неможливий.</p>)}
            {done ? <p><b>{done}</b></p> : (
                <button
                    disabled={!!pending || state === null || (action === 'ban' && (!search || alreadyBanned))}
                    onClick={() => run(action).then(r => {
                        if (r?.status === 'applied') setDone(action === 'ban' ? '🚫 Забанено' : '🙈 Сховано')
                        else if (r?.status === 'noop') setDone('Уже було зроблено')
                    })}
                >
                    {pending ? 'Виконую…' : action === 'ban' ? 'Підтвердити бан' : 'Підтвердити приховування'}
                </button>
            )}
            <p><Link href={`/zhezhemon/history?${new URLSearchParams({ link })}`}>Картка та історія</Link> · <Link href="/zhezhemon">До каталогу</Link></p>
        </div>
    )
}

export default function ConfirmPage() {
    return (
        <main className="content">
            <Suspense fallback={<p>Завантаження…</p>}>
                <ConfirmInner />
            </Suspense>
        </main>
    )
}
