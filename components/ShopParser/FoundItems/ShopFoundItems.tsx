'use client'

import { useState } from 'react'
import { useShopItems, useShopItemsLoading } from '@/context/ShopItemsProvider'
import ShopItemCard from './ShopItemCard'
import styles from './FoundItems.module.css'
import { EyeOff, Loader } from 'lucide-react'

export default function ShopFoundItems({ id }: { id: number | undefined }) {
    const items = useShopItems()
    const loading = useShopItemsLoading()
    const allItems = id === undefined ? items : items.filter((item) => Number(item.search_id) === Number(id))

    const uniqueSellers = Array.from(new Set(allItems.map((item) => item.seller).filter(Boolean)))
    const [selectedSeller, setSelectedSeller] = useState<string | null>(null)
    const [filterHidden, setFilterHidden] = useState(false)

    const filteredItems = allItems
        .filter((item) => (filterHidden ? item.hidden : !item.hidden))
        .filter((item) => !selectedSeller || item.seller === selectedSeller)

    if (loading) return <Loader color='var(--primary)' className='loader' />

    return (
        <div className={styles.found_items}>
            <div className={styles.filters}>
                <div className={styles.filters_icons}>
                    <label className={styles.filter_liked}>
                        <input
                            type="checkbox"
                            checked={filterHidden}
                            onChange={(e) => setFilterHidden(e.target.checked)}
                        />
                        <EyeOff />
                    </label>
                </div>

                <label>
                    Seller:
                    <select value={selectedSeller || ""} onChange={(e) => setSelectedSeller(e.target.value || null)}>
                        <option value="">All</option>
                        {uniqueSellers.map((seller) => (
                            <option key={seller} value={seller}>{seller}</option>
                        ))}
                    </select>
                </label>
            </div>

            <h2 className={styles.found_items_count}>Found {filteredItems.length} items</h2>
            <div className={styles.items_grid}>
                {filteredItems.map((item) => (
                    <ShopItemCard key={item.id} item={item} />
                ))}
            </div>
        </div>
    )
}
