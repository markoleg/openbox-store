'use client'

import { useEffect, useState } from 'react'
import styles from '../SearchForm/SearchForm.module.css'
import { supabase } from '@/lib/SupaBaseClient'
import { Ban } from 'lucide-react'

interface Row { id: number; seller_name: string }

export default function GlobalBannedSellers() {
    const [open, setOpen] = useState(false)
    const [rows, setRows] = useState<Row[]>([])
    const [value, setValue] = useState('')

    useEffect(() => {
        supabase
            .from('shop_global_banned_sellers')
            .select('*')
            .order('seller_name', { ascending: true })
            .then(({ data }) => { if (data) setRows(data as Row[]) })
    }, [])

    const add = async () => {
        const name = value.trim()
        if (!name) return
        if (rows.some((r) => r.seller_name.toLowerCase() === name.toLowerCase())) { setValue(''); return }
        const { data, error } = await supabase
            .from('shop_global_banned_sellers')
            .insert({ seller_name: name })
            .select()
            .single()
        if (error) { console.error('Add global banned seller failed:', error); return }
        setRows((prev) => [...prev, data as Row].sort((a, b) => a.seller_name.localeCompare(b.seller_name)))
        setValue('')
    }

    const remove = async (id: number) => {
        const { error } = await supabase.from('shop_global_banned_sellers').delete().eq('id', id)
        if (error) { console.error('Remove global banned seller failed:', error); return }
        setRows((prev) => prev.filter((r) => r.id !== id))
    }

    return (
        <div className={`${styles.form_wrp} ${open ? styles.open : ''}`}>
            <h2 onClick={() => setOpen(!open)} className={styles.form_title}>
                <span>Global Banned Sellers ({rows.length})</span>
                <Ban />
            </h2>
            <div className={styles.form}>
                <fieldset className={styles.bannedLinks}>
                    <legend>Ignored in ALL searches</legend>
                    {rows.map((r) => (
                        <div key={r.id} className={styles.bannedLinkItem}>
                            <input type="text" value={r.seller_name} readOnly />
                            <button type="button" onClick={() => remove(r.id)}>✖</button>
                        </div>
                    ))}
                    <div className={styles.bannedLinkItem}>
                        <input
                            type="text"
                            placeholder="Seller name"
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
                        />
                        <button type="button" onClick={add}>+ Add</button>
                    </div>
                </fieldset>
            </div>
        </div>
    )
}
