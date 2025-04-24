'use client'
import { usePathname } from 'next/navigation';
import styles from './AsideMenu.module.css'
import Link from 'next/link';
import { useRealtimeSearches } from '@/hooks/useRealtimeSearches'
import { useMemo } from 'react';
import { useItems, useItemsLoading } from '@/context/ItemsProvider'
import { Loader } from 'lucide-react';

export default function AsideMenu() {
    const pathname = usePathname()
    const allItems = useItems()
    const searches = useRealtimeSearches()
    const loading = useItemsLoading()

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
    // if (loading) return (<aside className={styles.aside}>
    //     <Loader color='var(--primary)' className="loader" />
    // </aside>)

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
                {loading
                    ? <Loader color='var(--primary)' className="loader" />
                    : list.map((item, index) => (
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
