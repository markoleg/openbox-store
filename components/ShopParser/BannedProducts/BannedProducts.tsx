'use client'

import { useEffect, useState } from 'react'
import styles from '../SearchForm/SearchForm.module.css'
import { supabase } from '@/lib/SupaBaseClient'
import { Ban } from 'lucide-react'

interface Row { id: number; link: string; product_id: string | null; last_price: number | null }

// Derive a readable name from the product slug: /products/{id}/apple-airpods-4 -> "apple airpods 4"
function nameFromLink(link: string): string {
    const m = link.match(/\/products\/\d+\/(.+)$/)
    return m ? m[1].replace(/-/g, ' ') : link
}

export default function BannedProducts() {
    const [open, setOpen] = useState(false)
    const [rows, setRows] = useState<Row[]>([])
    const [value, setValue] = useState('')

    const load = () => {
        supabase
            .from('shop_seen')
            .select('id, link, product_id, last_price')
            .eq('banned', true)
            .order('id', { ascending: false })
            .then(({ data }) => { if (data) setRows(data as Row[]) })
    }
    useEffect(load, [])

    const unban = async (row: Row) => {
        const { error } = await supabase.from('shop_seen').update({ banned: false }).eq('id', row.id)
        if (error) { console.error('Unban failed:', error); return }
        setRows((prev) => prev.filter((r) => r.id !== row.id))
    }

    const addBan = async () => {
        const link = value.trim()
        if (!link) return
        if (rows.some((r) => r.link === link)) { setValue(''); return }
        const pid = link.match(/\/products\/(\d+)/)?.[1] ?? null
        const { error } = await supabase
            .from('shop_seen')
            .upsert({ link, product_id: pid, banned: true }, { onConflict: 'link' })
        if (error) { console.error('Add ban failed:', error); return }
        // also drop it from the current snapshot so it disappears now
        await supabase.from('shop_products').delete().eq('link', link)
        setValue('')
        load()
    }

    return (
        <div className={`${styles.form_wrp} ${open ? styles.open : ''}`}>
            <h2 onClick={() => setOpen(!open)} className={styles.form_title}>
                <span>Banned Products ({rows.length})</span>
                <Ban />
            </h2>
            <div className={styles.form}>
                <fieldset className={styles.bannedLinks}>
                    <legend>Ignored forever (any search, any price)</legend>
                    {rows.map((r) => (
                        <div key={r.id} className={styles.bannedLinkItem}>
                            <a href={r.link} target="_blank" rel="noopener noreferrer" title={r.link}
                                style={{ flex: 1, minWidth: 100, alignSelf: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--foreground)' }}>
                                {nameFromLink(r.link)}{r.last_price != null ? ` — $${r.last_price}` : ''}
                            </a>
                            <button type="button" onClick={() => unban(r)} title="Unban">✖</button>
                        </div>
                    ))}
                    <div className={styles.bannedLinkItem}>
                        <input
                            type="text"
                            placeholder="Product link to ban"
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addBan() } }}
                        />
                        <button type="button" onClick={addBan}>+ Ban</button>
                    </div>
                </fieldset>
            </div>
        </div>
    )
}
