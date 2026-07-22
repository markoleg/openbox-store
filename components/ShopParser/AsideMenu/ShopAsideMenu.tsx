'use client'
import { usePathname } from 'next/navigation';
import styles from './AsideMenu.module.css'
import Link from 'next/link';
import { useRealtimeShopSearches } from '@/hooks/useRealtimeShopSearches'
import { useMemo, useState } from 'react';
import { useShopItems, useShopItemsLoading } from '@/context/ShopItemsProvider'
import { GitCommitHorizontal, Loader, SquareMenu } from 'lucide-react';

export default function ShopAsideMenu() {
    const pathname = usePathname()
    const allItems = useShopItems()
    const searches = useRealtimeShopSearches()
    const loading = useShopItemsLoading()
    const [open, setOpen] = useState(false)

    const list = useMemo(() => {
        return searches.map((search) => {
            const items = allItems.filter((item) => item.search_id === search.id && !item.hidden)
            return {
                name: search.query,
                path: `/shop/${search.id}`,
                id: search.id,
                qty: items.length,
                rate: search.rate,
                enabled: search.enabled,
            }
        })
    }, [searches, allItems])

    return (
        <>
            <div className={styles.aside_brg}>
                <SquareMenu className={styles.aside_brg} onClick={() => setOpen(!open)} />
            </div>
            <aside className={`${styles.aside} ${open ? styles.open : ""}`}>
                <div className={styles.aside_menu} onClick={() => setOpen(false)}>
                    <Link href="/shop" className={pathname === "/shop" ? styles.active : ""}>
                        <span>All Searches</span>
                        <span className={styles.qty}>{allItems.filter((item) => !item.hidden).length}</span>
                    </Link>
                    {loading
                        ? <Loader color='var(--primary)' className="loader" />
                        : list.map((item) => (
                            <Link
                                href={item.path}
                                key={item.id}
                                className={pathname === item.path ? styles.active : ""}
                                style={item.enabled ? undefined : { opacity: 0.5 }}
                            >
                                <GitCommitHorizontal />
                                <span>{item.name}</span>
                                <small className={styles.rate}>({item.rate})</small>
                                <span className={styles.qty}>{item.qty}</span>
                            </Link>
                        ))}
                </div>
            </aside>
        </>
    )
}
