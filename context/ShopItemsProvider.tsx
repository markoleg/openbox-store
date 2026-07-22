'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from "@/lib/SupaBaseClient";
import { toast } from "react-toastify";

// Row from shop_products (current snapshot). hidden/banned come from shop_seen (merged).
export interface ShopItem {
    id: number;
    link: string;
    search_id: number;
    title: string;
    image_url: string;
    seller: string;
    price: number;
    hidden: boolean;
    banned: boolean;
    hide_price_threshold?: number | null;
}

interface SeenFlags {
    hidden: boolean;
    banned: boolean;
    hide_price_threshold: number | null;
}

interface ShopItemsContextType {
    items: ShopItem[]
    isLoading: boolean
}

const ShopItemsContext = createContext<ShopItemsContextType>({ items: [], isLoading: true })

export function ShopItemsProvider({ children }: { children: React.ReactNode }) {
    const [products, setProducts] = useState<any[]>([])
    const [seen, setSeen] = useState<Record<string, SeenFlags>>({})
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const fetchInitial = async () => {
            const [{ data: prod }, { data: seenRows }] = await Promise.all([
                supabase.from('shop_products').select('*').order('price', { ascending: true }),
                supabase.from('shop_seen').select('link, hidden, banned, hide_price_threshold'),
            ])
            if (prod) setProducts(prod)
            if (seenRows) {
                const map: Record<string, SeenFlags> = {}
                for (const r of seenRows as any[]) {
                    map[r.link] = { hidden: r.hidden, banned: r.banned, hide_price_threshold: r.hide_price_threshold }
                }
                setSeen(map)
            }
            setIsLoading(false)
        }
        fetchInitial()

        const productsChannel = supabase.channel('shop-products')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'shop_products' }, (payload) => {
                const p = payload.new as any
                setProducts((prev) => (prev.find((x) => x.id === p.id) ? prev : [p, ...prev]))
                toast.info(
                    <p>
                        NEW:{" "}
                        <a href={p.link} target="_blank" rel="noopener noreferrer" style={{ color: "#00d084", textDecoration: "underline" }}>
                            {p.title}
                        </a>
                        <br />
                        <span style={{ color: 'var(--primary)' }}>for <b>${p.price}</b></span>{" "}
                        <span><b>{p.seller}</b></span>
                    </p>,
                    { className: "custom-toast", progressClassName: "Toastify__progress-bar" }
                )
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'shop_products' }, (payload) => {
                const p = payload.new as any
                const oldPrice = (payload.old as any)?.price
                setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, ...p } : x)))
                if (oldPrice != null && p.price != null && p.price < oldPrice) {
                    toast.info(
                        <p>
                            ⬇️{" "}
                            <a href={p.link} target="_blank" rel="noopener noreferrer" style={{ color: "#00d084", textDecoration: "underline" }}>
                                {p.title}
                            </a>
                            <br />
                            now <b>${p.price}</b> (was ${oldPrice})
                        </p>,
                        { className: "custom-toast", progressClassName: "Toastify__progress-bar" }
                    )
                }
            })
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'shop_products' }, (payload) => {
                setProducts((prev) => prev.filter((x) => x.id !== Number((payload.old as any).id)))
            })
            .subscribe()

        const seenChannel = supabase.channel('shop-seen')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'shop_seen' }, (payload) => {
                const row = (payload.new ?? payload.old) as any
                if (!row?.link) return
                setSeen((prev) => ({
                    ...prev,
                    [row.link]: {
                        hidden: row.hidden ?? false,
                        banned: row.banned ?? false,
                        hide_price_threshold: row.hide_price_threshold ?? null,
                    },
                }))
            })
            .subscribe()

        return () => {
            supabase.removeChannel(productsChannel)
            supabase.removeChannel(seenChannel)
        }
    }, [])

    const items: ShopItem[] = useMemo(() => {
        return products
            .map((p) => {
                const flags = seen[p.link]
                return {
                    ...p,
                    hidden: flags?.hidden ?? false,
                    banned: flags?.banned ?? false,
                    hide_price_threshold: flags?.hide_price_threshold ?? null,
                } as ShopItem
            })
            .filter((it) => !it.banned) // banned items never show
    }, [products, seen])

    return (
        <ShopItemsContext.Provider value={{ items, isLoading }}>
            {children}
        </ShopItemsContext.Provider>
    )
}

export function useShopItems() {
    return useContext(ShopItemsContext).items
}
export function useShopItemsLoading() {
    return useContext(ShopItemsContext).isLoading
}
