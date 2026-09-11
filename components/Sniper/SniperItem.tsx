'use client'
import styles from './SniperItems.module.css';
import { useState } from "react";
import { Check, CheckCheck, History, Trash2, Zap, ZapOff } from "lucide-react";
import Link from 'next/link';
import { SniperItemType } from '@/app/(home)/sniper/page';
import { explainError, explainResult, runCommand } from '@/lib/reviewClient';
import type { ReviewAction, ReviewPayload } from '@/lib/reviewCommands';

/**
 * One watch rule. Save/⚡/🗑 are explicit commands on the listing; the server
 * returns noop for an unchanged Save and only re-arms the call for a real
 * target change, so pressing Save after editing the note is harmless.
 */
export default function SniperItem({ item, onChanged }: { item: SniperItemType; onChanged?: () => void }) {
    const [saved, setSaved] = useState(false);
    const [desiredPrice, setDesiredPrice] = useState(item.desired_price ?? 0);
    const [description, setDescription] = useState(item.description || '');
    const [busy, setBusy] = useState<ReviewAction | null>(null);
    const [error, setError] = useState<string | null>(null);

    const run = async (action: ReviewAction, payload: ReviewPayload = {}) => {
        if (busy) return;
        setBusy(action); setError(null);
        try {
            const { result } = await runCommand({ kind: 'listing', link: item.link }, action, payload);
            const { ok, text } = explainResult(action, result);
            if (!ok) setError(text);
            else { setSaved(true); onChanged?.(); }
        } catch (e) {
            setError(explainError(e));
        } finally {
            setBusy(null);
        }
    };
    const watch = (superFavorite: boolean): ReviewPayload => ({
        favorite: true, super_favorite: superFavorite, desired_price: Number(desiredPrice) > 0 ? Number(desiredPrice) : null,
        description: description.trim() || null,
    });

    if (!item) return null;
    return (
        <div className={styles.sniper_item} >
            <Link href={item.link} target="_blank" rel="noopener noreferrer" className={styles.sniper_item_link}>
                {item.link}
            </Link>
            <input type="text" name='description' value={description} placeholder="Нотатка Sniper"
                onChange={(e) => { setDescription(e.target.value); setSaved(false); }} maxLength={2000} />
            <div className={styles.sniper_item_header}>
                <input type="number" name="desired_price" value={desiredPrice} min={0.01} step="0.01"
                    onChange={(e) => { setDesiredPrice(Number(e.target.value)); setSaved(false); }} />
                <button className={styles.sniper_button} title="Прибрати зі Sniper" disabled={!!busy}
                    onClick={() => { if (confirm('Прибрати зі Sniper? Історія та оцінка лишаються.')) run('remove_watch'); }}>
                    <Trash2 />
                </button>
                <button
                    className={styles.sniper_button}
                    title={item.super_favorite ? 'Супер-товар: буде дзвінок. Вимкнути' : 'Зробити супер-товаром'}
                    disabled={!!busy}
                    onClick={() => run('set_watch', watch(!item.super_favorite))}
                >
                    {item.super_favorite ? <Zap /> : <ZapOff />}
                </button>
                <button className={styles.sniper_button} title="Зберегти" disabled={!!busy}
                    onClick={() => run('set_watch', watch(!!item.super_favorite))}>
                    {saved ? <CheckCheck /> : <Check />}
                </button>
                <Link className={styles.sniper_button} href={`/zhezhemon/history?${new URLSearchParams({ link: item.link })}`} title="Картка та історія">
                    <History />
                </Link>
            </div>
            {error && <p className={styles.sniper_error}>{error}</p>}
        </div>
    )
}
