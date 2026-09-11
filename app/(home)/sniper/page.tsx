'use client'
import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import SniperItems from "@/components/Sniper/SniperItems";
import { supabase } from "@/lib/SupaBaseClient";
import styles from '@/components/Sniper/SniperItems.module.css';
import { normalizeListingLink } from '@/lib/reviewCommands';
import { applyCommand, explainError, explainResult, issueContext, type ReviewTarget } from '@/lib/reviewClient';

export type SniperItemType = {
    link: string;                // primary key, text
    first_seen: string;         // timestamp (ISO string)
    count: number;              // int4
    favorite: boolean;          // boolean
    super_favorite: boolean;    // boolean — escalates to a phone call
    desired_price: number | null; // float4, nullable
    description: string | null; // text, nullable — the Sniper note, not eBay's description
};

/**
 * Sniper: one watch rule per listing (target price, note, super escalation).
 *
 * Every Save/Remove is an explicit command; the server decides what changed,
 * whether escalation re-arms (only a real target change does) and journals
 * old/new values. When the form is opened from a Telegram button it carries
 * `ctx` (the dispatch); a successful Save is then a reaction to that exact
 * message. Editing the link to another listing drops that binding visibly.
 */
function SniperForm() {
    const [favItems, setFavItems] = useState<SniperItemType[]>([]);
    const [link, setLink] = useState('');
    const [note, setNote] = useState('');
    const [hint, setHint] = useState('');
    const [price, setPrice] = useState('');
    const [superWatch, setSuperWatch] = useState(false);
    const [origin, setOrigin] = useState<{ token?: string; event?: string; link: string } | null>(null);
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        // New buttons send `link`/`hint`; older messages still carry the legacy names.
        const initialLink = params.get('link') ?? params.get('itemLink') ?? '';
        const initialHint = params.get('hint') ?? params.get('itemDescription') ?? '';
        setLink(initialLink);
        // The hint is a suggestion for a NEW watch only; it never overwrites an existing note.
        setHint(initialHint);
        setNote(initialHint);
        const token = params.get('ctx') ?? undefined;
        const event = params.get('event') ?? undefined;
        if ((token || event) && initialLink) setOrigin({ token, event, link: normalizeListingLink(initialLink) ?? initialLink });
    }, []);

    const refresh = useCallback(async () => {
        const { data } = await supabase
            .from('scraped_links')
            .select('*')
            .eq('favorite', true)
            .order('desired_price', { ascending: true });
        setFavItems(data ?? []);
    }, []);
    useEffect(() => { refresh(); }, [refresh]);

    useEffect(() => {
        const existing = favItems.find(item => item.link === normalizeListingLink(link));
        if (existing) {
            if (existing.description && note === hint) setNote(existing.description);
            if (!price && existing.desired_price) setPrice(String(existing.desired_price));
            setSuperWatch(!!existing.super_favorite);
        }
    }, [favItems, link]); // eslint-disable-line react-hooks/exhaustive-deps

    const boundToMessage = !!origin && normalizeListingLink(link) === origin.link;

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);
        const canonical = normalizeListingLink(link);
        const desired = Number(price);
        if (!canonical) { setMessage({ ok: false, text: 'Це не посилання на оголошення eBay (/itm/…)' }); return; }
        if (!(desired > 0)) { setMessage({ ok: false, text: 'Вкажи бажану ціну' }); return; }
        setBusy(true);
        try {
            // Exact message context only while the link is still that message's listing.
            let target: ReviewTarget = { kind: 'listing', link: canonical, register: true };
            if (boundToMessage && origin?.token) target = { kind: 'dispatch', token: origin.token };
            else if (boundToMessage && origin?.event) target = { kind: 'event', eventId: origin.event };
            let context = await issueContext(target);
            if (context.link !== canonical) {
                // The message context belongs to a different listing: fall back honestly.
                context = await issueContext({ kind: 'listing', link: canonical, register: true });
            }
            const result = await applyCommand(context.id, 'set_watch', {
                favorite: true, super_favorite: superWatch, desired_price: desired, description: note.trim() || null,
            });
            const explained = explainResult('set_watch', result);
            setMessage(explained);
            if (explained.ok) {
                setLink(''); setNote(''); setHint(''); setPrice(''); setSuperWatch(false); setOrigin(null);
                await refresh();
            }
        } catch (error) {
            setMessage({ ok: false, text: explainError(error) });
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            <form onSubmit={submit} className={styles.sniper_form}>
                <div>
                    <label htmlFor="itemLink">Посилання:</label>
                    <input type="url" id="itemLink" name="link" required value={link} onChange={e => setLink(e.target.value)} placeholder="https://www.ebay.com/itm/…" />
                </div>
                <div>
                    <label htmlFor="itemDescription">Нотатка Sniper:</label>
                    <input type="text" id="itemDescription" name="description" value={note} onChange={e => setNote(e.target.value)} maxLength={2000} />
                </div>
                <div>
                    <label htmlFor="itemDesiredPrice">Бажана ціна:</label>
                    <input type="number" id="itemDesiredPrice" name="desired_price" required min={0.01} step="0.01" value={price} onChange={e => setPrice(e.target.value)} />
                    <label title="Супер-товар: дзвінок при досягненні ціни"><input type="checkbox" checked={superWatch} onChange={e => setSuperWatch(e.target.checked)} /> ⚡</label>
                </div>
                <button type="submit" className={styles.sniper_form_button} disabled={busy}>{busy ? 'Збереження…' : 'Зберегти'}</button>
            </form>
            {origin && (
                <p className={styles.sniper_note}>
                    {boundToMessage
                        ? 'Збереження буде реакцією на повідомлення, з якого відкрито форму.'
                        : 'Посилання змінено — це інше оголошення, прив’язку до повідомлення знято.'}
                    {origin.token && <> · <Link href={`/zhezhemon/history?dispatch=${encodeURIComponent(origin.token)}`}>Повернутись до картки</Link></>}
                </p>
            )}
            {message && <p className={styles.sniper_note} style={{ color: message.ok ? '#00d084' : 'salmon' }}>{message.text}</p>}
            <br />
            <SniperItems items={favItems} onChanged={refresh} />
        </>
    );
}

export default function SniperPage() {
    return (
        <main className='content'>
            <h1>Sniper</h1>
            <p>Спостереження за ціною: лот, нотатка, бажана ціна. Кожне збереження — журнальована команда.</p>
            <br />
            <Suspense fallback={<div>Loading...</div>}>
                <SniperForm />
            </Suspense>
        </main>
    );
}
