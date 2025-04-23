'use client'
import { usePathname } from 'next/navigation';
import styles from './AsideMenu.module.css'
import Link from 'next/link';
// import { usePathname } from 'next/navigation'

export default function AsideMenu({ list, allItems }: { list: { name: string; path: string; id: number, items: number }[]; allItems: number }) {
    const pathname = usePathname()
    return (
        <aside className={styles.aside}>
            <div className={styles.aside_menu}>
                <Link href="/zhezhemon" className={pathname === "/zhezhemon" ? styles.active : ""}>
                    <span>
                        All Searches
                    </span>
                    <span>
                        {allItems}
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
                            {item.items}
                        </span>
                    </Link>
                ))}
            </div>
        </aside>
    )
}
