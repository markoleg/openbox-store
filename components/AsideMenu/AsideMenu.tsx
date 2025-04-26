'use client'
import { usePathname } from 'next/navigation';
import styles from './AsideMenu.module.css'
import Link from 'next/link';
import { useRealtimeSearches } from '@/hooks/useRealtimeSearches'
import { useMemo, useState } from 'react';
import { useItems, useItemsLoading } from '@/context/ItemsProvider'
import { GitCommitHorizontal, Loader, SquareMenu } from 'lucide-react';

export default function AsideMenu() {
    const pathname = usePathname()
    const allItems = useItems()
    const searches = useRealtimeSearches()
    const loading = useItemsLoading()
    const [open, setOpen] = useState(false)
    const list = useMemo(() => {
        return searches.map((search: any) => {
            const items = allItems.filter((item: any) => item.search_parameter_id === search.id);
            const { id, keywords, seller, condition } = search;
            const searchCondition = condition === 1000 ? "New" : condition === 1500 ? "OpenBox" : "Used";
            const searchName = `${seller ?? ""} ${keywords} ${searchCondition}`;
            return {
                name: searchName,
                path: `/zhezhemon/${id}`,
                id: id,
                qty: items.length
            };
        })
    }, [searches, allItems])

    return (
        <>
            <div className={styles.aside_brg}>

                <SquareMenu
                    className={styles.aside_brg}
                    onClick={() => setOpen(!open)}
                />
            </div>
            <aside className={`${styles.aside} ${open ? styles.open : ""}`}>
                <div className={styles.aside_menu}
                    onClick={() => setOpen(false)}
                >
                    <Link
                        href="/zhezhemon"
                        className={pathname === "/zhezhemon" ? styles.active : ""}

                    >
                        <span>
                            All Searches
                        </span>
                        <span>
                            {allItems.length}
                        </span>
                    </Link>
                    {loading
                        ? <Loader color='var(--primary)' className="loader" />
                        : list.map((item, index) => (
                            <Link
                                href={item.path}
                                key={index}
                                className={pathname === item.path ? styles.active : ""}
                            >
                                {/* <span>
                                {item.id}.
                            </span> */}
                                <GitCommitHorizontal />
                                <span>
                                    {item.name}
                                </span>
                                <span>
                                    {item.qty}
                                </span>
                            </Link>
                        ))}
                </div>
            </aside>
        </>

    )
}
