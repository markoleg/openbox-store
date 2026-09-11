import Link from 'next/link'
import { redirect } from 'next/navigation'
import { isListingLink, isUuid } from '@/lib/reviewCommands'
import { outcomeLabels } from '@/lib/reviewKeyboard'
import { deliveryView, eventLink, listingHistory, resolveDispatch, reviewCommandsEnabled } from '@/lib/server/reviewCommands'
import { requireOwnerSession } from '@/lib/server/owner'
import OutcomeForm from '@/components/ZheZhemon/Review/OutcomeForm'
import GeneralOutcomeForm from '@/components/ZheZhemon/Review/GeneralOutcomeForm'
import { historyBoardDestination } from '@/lib/reviewBoards'
import type { ReviewTarget } from '@/lib/reviewClient'
import styles from '@/components/ZheZhemon/Review/Review.module.css'

export const dynamic = 'force-dynamic'

const actionLabels: Record<string, string> = {
    review_ack: '🖐 Опрацьовую', hide: '🙈 Hide', pause: '⏸ Пауза', extend_pause: '⏸ Продовження паузи', unhide: '👁 Показати знову',
    ban: '🚫 Ban', unban: '♻️ Зняти бан', set_like: '❤️ Лайк', set_outcome: 'Результат', clear_outcome: '🧹 Скидання результату',
    set_watch: '🎯 Sniper', remove_watch: '🎯 Прибрано зі Sniper',
}
const sourceLabels: Record<string, string> = {
    telegram: 'Telegram', legacy_telegram: 'Telegram (стара кнопка)', dashboard: 'дашборд', dashboard_toast: 'toast', search_form: 'форма пошуку',
}
const kyiv = (iso: string | null | undefined) => iso ? new Date(iso).toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' }) : '—'

type Params = { dispatch?: string; delivery?: string; event?: string; link?: string; action?: string }

function redirectDeliveredCard(context: {kind:'event'|'delivery';id:string} | null, view:Awaited<ReturnType<typeof deliveryView>>, action?:string) {
    if (context?.kind === 'delivery') redirect(historyBoardDestination(view ?? {deliveryId:context.id,review:null},action))
}

/**
 * The persistent card of one listing: every message, every reaction, the live
 * state next to them. GET changes nothing. When opened from a specific message
 * (dispatch/delivery) the outcome form addresses that exact context; opened
 * from the catalog it only shows history — a general listing action never
 * claims a reaction time for "the latest notification".
 *
 * The six-criteria training form is the next phase (boards); the card status
 * is shown here so the Telegram button already lands somewhere honest.
 */
export default async function HistoryPage({ searchParams }: { searchParams: Promise<Params> }) {
    const params = await searchParams
    try { await requireOwnerSession() }
    catch { redirect(`/login?next=${encodeURIComponent('/zhezhemon/history?' + new URLSearchParams(params as Record<string, string>))}`) }
    let context: { kind: 'delivery'; id: string } | { kind: 'event'; id: string } | null = null
    let link: string | null = null
    let notification:Awaited<ReturnType<typeof deliveryView>>=null
    try {
        if (params.dispatch) {
            const resolved = await resolveDispatch(params.dispatch)
            if (resolved) context = { kind: resolved.kind, id: resolved.target }
        } else if (params.delivery && isUuid(params.delivery)) context = { kind: 'delivery', id: params.delivery }
        else if (params.event && isUuid(params.event)) context = { kind: 'event', id: params.event }
        if (context?.kind === 'delivery') {notification=await deliveryView(context.id);link=notification?.link ?? null}
        else if (context?.kind === 'event') link = await eventLink(context.id)
        if (!link && isListingLink(params.link ?? '')) link = params.link ?? null
    } catch {
        return <main className="content"><p>Історія недоступна: сервер команд не налаштовано.</p></main>
    }
    if (!link) return <main className="content"><p>Оголошення не знайдено.</p> <Link href="/zhezhemon">До каталогу</Link></main>

    // Existing Telegram URLs remain valid and now open the exact board card.
    // An event without a confirmed delivery stays in the technical history.
    redirectDeliveredCard(context, notification, params.action)

    const history = await listingHistory(link)
    const view = context?.kind === 'delivery' ? await deliveryView(context.id) : null
    const eventResult = context?.kind === 'event'
        ? history.deliveries.find(d => d.event_id === context!.id) ?? null : null
    const generalResult = !context ? history.reactions.find(r => !r.event_id && (r.outcome || r.action==='clear_outcome')) : null
    const currentOutcome = generalResult ? generalResult.outcome : view ? view.outcome
        : eventResult ? history.reactions.find(r => r.id === eventResult.resolved_by_reaction_id)?.outcome ?? null : null
    const firstReactionAt = view ? view.firstReactionAt
        : eventResult ? history.reactions.find(r => r.id === eventResult.first_reaction_id)?.received_at ?? null : null
    const target: ReviewTarget = context?.kind === 'delivery' ? { kind: 'delivery', deliveryId: context.id }
        : context?.kind === 'event' ? { kind: 'event', eventId: context.id } : {kind:'listing',link}
    const title = history.state?.latest_summary && typeof history.state.latest_summary === 'object'
        ? String((history.state.latest_summary as { title?: string }).title ?? link) : link
    const live = history.live
    const review = history.review
    const reviewStatus = !review ? (history.state?.training_eligible ? 'кандидат без доставки' : 'не навчальний приклад')
        : review.submitted_at && !(review.revision_opened_at && review.revision_opened_at > review.submitted_at)
            ? `оцінено ${kyiv(review.submitted_at)} (v${review.version})`
            : 'потребує завершення оцінки'

    return (
        <main className="content">
            <div className={styles.card}>
                <h1>{title}</h1>
                {review && <Link href={`/zhezhemon/processing?${new URLSearchParams({tab:'review',review:review.id})}`}>Відкрити навчальну картку та шість критеріїв</Link>}
                {!context && <p className={styles.muted}>Тут рішення «Про оголошення загалом»: воно не обробляє повідомлення та не вимірює час реакції на Telegram. Щоб відповісти на конкретне сповіщення, обери його нижче. Сам перегляд не є реакцією.</p>}
                <p><a href={link} target="_blank" rel="noopener noreferrer">{link}</a></p>
                <section>
                    <h2>Живий стан</h2>
                    {live ? (
                        <p>
                            {live.hidden ? `🙈 приховано${live.hidden_until ? ' до ' + kyiv(live.hidden_until) : ' до подешевшання'}` : 'видиме'}
                            {live.price != null ? ` · поріг $${live.price}` : ''}
                            {history.state?.observed_total != null ? ` · остання ціна $${history.state.observed_total} (${kyiv(history.state.latest_seen_at)})` : ''}
                            {live.favorite ? ` · 🎯 Sniper ${live.desired_price != null ? '$' + live.desired_price : ''}${live.super_favorite ? ' ⚡' : ''}` : ''}
                            {history.state?.liked ? ' · ❤️' : ''}
                            {view?.live.bannedInSearch ? ` · 🚫 забанено в «${view.searchName}»` : ''}
                        </p>
                    ) : <p className={styles.muted}>Немає в реєстрі лінків.</p>}
                    <p className={styles.muted}>Навчальна картка: {reviewStatus}</p>
                    <p><Link className={styles.action} href={`/sniper?${new URLSearchParams({ link })}`}>🎯 Sniper</Link></p>
                </section>

                {target && (
                    <section>
                        <h2>{!context?'Про оголошення загалом':view ? `Повідомлення ${kyiv(view.sentAt)} · ${view.kind} · ${view.channel === 'main' ? 'основний чат' : 'sniper-чат'}` : 'Подія (toast / повідомлення ще без підтвердження)'}</h2>
                        {view && <p>Ціна в повідомленні: ${view.contextPrice ?? '?'}{view.currentPrice != null ? ` · зараз $${view.currentPrice}` : ''}{view.searchName ? ` · пошук «${view.searchName}»${view.searchExists ? '' : ' (видалений)'}` : ''}</p>}
                        <p>Результат: <b>{currentOutcome ? outcomeLabels[currentOutcome] ?? currentOutcome : firstReactionAt ? 'в роботі' : 'нове'}</b>
                            {view?.resolutionKind && view.resolutionKind !== 'direct' ? ` (${view.resolutionKind === 'event_context' ? 'з дашборда до відправки' : 'через пов’язане повідомлення'})` : ''}</p>
                        {reviewCommandsEnabled() ? (
                            target.kind==='listing' ? <GeneralOutcomeForm link={link} version={history.state?.state_version ?? 0}
                                current={{outcome:currentOutcome,firstReactionAt,hidden:!!live?.hidden,bannedInSearch:null}}/> : <OutcomeForm target={target} initialAction={params.action ?? null}
                                current={{ outcome: currentOutcome, firstReactionAt, hidden: !!live?.hidden, bannedInSearch: view?.live.bannedInSearch ?? null }} />
                        ) : <p className={styles.muted}>Команди вимкнені на сервері.</p>}
                    </section>
                )}

                <section>
                    <h2>Повідомлення ({history.deliveries.length})</h2>
                    {history.deliveries.length === 0 ? <p className={styles.muted}>Підтверджених доставок немає.</p> : (
                        <table>
                            <thead><tr><th>Коли</th><th>Чат</th><th>Подія</th><th>Результат</th><th></th></tr></thead>
                            <tbody>
                                {history.deliveries.map(d => {
                                    const outcome = history.reactions.find(r => r.id === d.resolved_by_reaction_id)?.outcome ?? null
                                    const event = history.events.find(e => e.id === d.event_id)
                                    const isCurrent = context?.kind === 'delivery' && context.id === d.id
                                    return (
                                        <tr key={d.id} className={isCurrent ? styles.current : ''}>
                                            <td>{kyiv(d.telegram_sent_at)}</td>
                                            <td>{d.channel === 'main' ? 'основний' : 'sniper'}</td>
                                            <td>{event?.kind ?? '—'}</td>
                                            <td>{outcome ? outcomeLabels[outcome] ?? outcome : d.first_reaction_id ? 'в роботі' : 'нове'}{d.resolution_kind && d.resolution_kind !== 'direct' ? ` (${d.resolution_kind})` : ''}</td>
                                            <td>{!isCurrent && <Link href={`/zhezhemon/history?${new URLSearchParams({ delivery: d.id })}`}>відкрити</Link>}</td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    )}
                </section>

                <section>
                    <h2>Дії ({history.reactions.length})</h2>
                    {history.reactions.length === 0 ? <p className={styles.muted}>Дій ще не було.</p> : (
                        <table>
                            <thead><tr><th>Коли</th><th>Дія</th><th>Результат</th><th>Причина / нотатка</th><th>Джерело</th></tr></thead>
                            <tbody>
                                {history.reactions.map(r => (
                                    <tr key={r.id}>
                                        <td>{kyiv(r.received_at)}</td>
                                        <td>{actionLabels[r.action] ?? r.action}{r.delivery_id ? '' : r.event_id ? ' · подія' : ' · загалом'}</td>
                                        <td>{r.outcome ? outcomeLabels[r.outcome] ?? r.outcome : '—'}{r.supersedes_reaction_id ? ' (виправлення)' : ''}</td>
                                        <td>{[r.reason_code, r.note].filter(Boolean).join(' · ') || '—'}</td>
                                        <td>{sourceLabels[r.source] ?? r.source}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </section>

                {history.events.some(e => e.preflight_status.startsWith('suppressed')) && (
                    <section>
                        <h2>Не надіслано</h2>
                        <table>
                            <tbody>
                                {history.events.filter(e => e.preflight_status.startsWith('suppressed')).map(e => (
                                    <tr key={e.id}><td>{kyiv(e.detected_at)}</td><td>{e.kind}</td><td>{e.preflight_status}{e.suppression_reason ? ` · ${e.suppression_reason}` : ''}</td></tr>
                                ))}
                            </tbody>
                        </table>
                    </section>
                )}
                <p><Link href="/zhezhemon">До каталогу</Link></p>
            </div>
        </main>
    )
}
