'use client'

import { useTransition, useState } from 'react'
import styles from './SearchForm.module.css'
import { SquarePlus } from 'lucide-react'
import { addShopSearch } from '@/actions/shopSearchActions'

export default function AddNewShopSearchForm() {
    const [openForm, setOpenForm] = useState(false)
    const [isPending, startTransition] = useTransition()
    const [bannedSellers, setBannedSellers] = useState<string[]>([])
    const [stopWords, setStopWords] = useState<string[]>([])

    const updateAt = (arr: string[], set: (v: string[]) => void, i: number, v: string) => {
        const next = [...arr]; next[i] = v; set(next)
    }

    return (
        <div className={`${styles.form_wrp} ${openForm ? styles.open : ''}`}>
            <h2 onClick={() => setOpenForm(!openForm)} className={styles.form_title}>
                <span>Add New Search</span>
                <SquarePlus />
            </h2>
            <form
                action={(formData) => {
                    bannedSellers.forEach((s, i) => formData.append(`banned_seller_${i}`, s))
                    stopWords.forEach((s, i) => formData.append(`stop_word_${i}`, s))
                    startTransition(() => addShopSearch(formData))
                }}
                className={styles.form}
            >
                <label>Query:<input type="text" name="query" required /></label>
                <label>Min Price:<input type="number" step="0.01" name="min_price" /></label>
                <label>Max Price:<input type="number" step="0.01" name="max_price" /></label>
                <label>Rate (sec):<input type="number" name="rate" defaultValue={1800} /></label>
                <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    Enabled:<input type="checkbox" name="enabled" defaultChecked />
                </label>

                <fieldset className={styles.bannedLinks}>
                    <legend>Banned Sellers</legend>
                    {bannedSellers.map((s, i) => (
                        <div key={i} className={styles.bannedLinkItem}>
                            <input type="text" placeholder="Seller name" value={s}
                                onChange={(e) => updateAt(bannedSellers, setBannedSellers, i, e.target.value)} />
                            <button type="button" onClick={() => setBannedSellers(bannedSellers.filter((_, j) => j !== i))}>✖</button>
                        </div>
                    ))}
                    <button type="button" onClick={() => setBannedSellers([...bannedSellers, ''])}>+ Add Seller</button>
                </fieldset>

                <fieldset className={styles.moreAspects}>
                    <legend>Stop Words</legend>
                    {stopWords.map((s, i) => (
                        <div key={i} className={styles.bannedLinkItem}>
                            <input type="text" placeholder="Stop word" value={s}
                                onChange={(e) => updateAt(stopWords, setStopWords, i, e.target.value)} />
                            <button type="button" onClick={() => setStopWords(stopWords.filter((_, j) => j !== i))}>✖</button>
                        </div>
                    ))}
                    <button type="button" onClick={() => setStopWords([...stopWords, ''])}>+ Add Stop Word</button>
                </fieldset>

                <button type="submit" disabled={isPending}>{isPending ? 'Adding...' : 'Add New Search'}</button>
            </form>
        </div>
    )
}
