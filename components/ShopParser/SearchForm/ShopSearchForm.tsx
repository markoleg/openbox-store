'use client'

import { useTransition, useState, useEffect } from 'react'
import { useRealtimeShopSearches } from '@/hooks/useRealtimeShopSearches'
import { updateShopSearch, deleteShopSearch } from '@/actions/shopSearchActions'
import styles from './SearchForm.module.css'
import { Loader, Settings } from 'lucide-react'

export default function ShopSearchForm({ searchId }: { searchId: number | undefined }) {
    const search = useRealtimeShopSearches(searchId)[0]
    const [openForm, setOpenForm] = useState(false)
    const [isPending, startTransition] = useTransition()
    const [bannedSellers, setBannedSellers] = useState<string[]>([])
    const [stopWords, setStopWords] = useState<string[]>([])

    useEffect(() => { if (search?.banned_sellers) setBannedSellers(search.banned_sellers) }, [search])
    useEffect(() => { if (search?.stop_words) setStopWords(search.stop_words) }, [search])

    if (!search) return <Loader color='var(--primary)' className='loader' />

    const updateAt = (arr: string[], set: (v: string[]) => void, i: number, v: string) => {
        const next = [...arr]; next[i] = v; set(next)
    }

    return (
        <div className={`${styles.form_wrp} ${openForm ? styles.open : ''}`}>
            <h2 onClick={() => setOpenForm(!openForm)} className={styles.form_title}>
                <span>Search Parameters</span>
                <Settings />
            </h2>
            <form
                action={(formData) => {
                    bannedSellers.forEach((s, i) => formData.append(`banned_seller_${i}`, s))
                    stopWords.forEach((s, i) => formData.append(`stop_word_${i}`, s))
                    startTransition(() => updateShopSearch(formData))
                }}
                className={styles.form}
            >
                <input type="hidden" name="id" value={search.id} />
                <label>Query:<input type="text" name="query" defaultValue={search.query} required /></label>
                <label>Min Price:<input type="number" step="0.01" name="min_price" defaultValue={search.min_price ?? ''} /></label>
                <label>Max Price:<input type="number" step="0.01" name="max_price" defaultValue={search.max_price ?? ''} /></label>
                <label>Rate (sec):<input type="number" name="rate" defaultValue={search.rate} /></label>
                <label style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 14 }}>
                    Enabled:<input style={{ flex: 0 }} type="checkbox" name="enabled" defaultChecked={search.enabled} />
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

                <button
                    type='button'
                    onClick={() => { if (confirm('Are you sure you want to delete this search?')) deleteShopSearch(search.id) }}
                    className={styles.delete_btn}
                >
                    Delete
                </button>
                <button type="submit" disabled={isPending}>{isPending ? 'Saving...' : 'Save'}</button>
            </form>
        </div>
    )
}
