'use client'
import { usePathname } from 'next/navigation';
import styles from './AsideMenu.module.css'
import Link from 'next/link';
import { useRealtimeSearches } from '@/hooks/useRealtimeSearches'
import { useMemo } from 'react';
import { useItems } from '@/context/ItemsProvider'

export default function AsideMenu() {
    const pathname = usePathname()
    // const allItems = useRealtimeItems(undefined)
    const allItems = useItems()
    const searches = useRealtimeSearches()

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
        <aside className={styles.aside}>
            <div className={styles.aside_menu}>
                <Link href="/zhezhemon" className={pathname === "/zhezhemon" ? styles.active : ""}>
                    <span>
                        All Searches
                    </span>
                    <span>
                        {allItems.length}
                    </span>
                </Link>
                {list.map((item, index) => (
                    <Link
                        href={item.path}
                        key={index}
                        className={pathname === item.path ? styles.active : ""}
                    >
                        <span>
                            {item.id}.
                        </span>
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
    )
}
