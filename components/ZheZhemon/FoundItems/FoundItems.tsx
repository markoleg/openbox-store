'use client'

import { useState } from 'react'
import { useItems, useItemsLoading } from '@/context/ItemsProvider'
import ItemCard from './ItemCard'
import styles from './FoundItems.module.css'
import { EyeOff, Heart, Loader } from 'lucide-react'

export default function FoundItems({ id }: { id: number | undefined }) {
    const allItems = id === undefined ? useItems() : useItems().filter(item => Number(item.search_parameter_id) === Number(id))
    const loading = useItemsLoading()
    const allSellers = allItems.map(item => item.seller_name)
    const uniqueSellers = Array.from(new Set(allSellers))
    const uniqueModels = Array.from(new Set(allItems.map(item => item.model).filter(model => !!model && model.trim() !== '')))
    const [selectedSeller, setSelectedSeller] = useState<string | null>(null)
    const [selectedCondition, setSelectedCondition] = useState<string | null>(null)
    const [selectedModel, setSelectedModel] = useState<string | null>(null)

    const [filterHidden, setFilterHidden] = useState(false)
    const [filterLiked, setFilterLiked] = useState(false)

    const filteredItems = allItems
        // .filter(item => !item.hidden)
        .filter(item => filterHidden ? item.hidden : !item.hidden)
        .filter(item => !filterLiked || item.liked)
        .filter(item => !selectedSeller || item.seller_name === selectedSeller)
        .filter(item => !selectedCondition || item.condition === selectedCondition)
        .filter(item => !selectedModel || item.model === selectedModel)

    if (loading) return <Loader color='var(--primary)' className='loader' />



    return (
        <div className={styles.found_items}>
            <div className={styles.filters}>
                <div className={styles.filters_icons}>

                    <label className={styles.filter_liked}>
                        <input
                            type="checkbox"
                            checked={filterLiked}
                            onChange={(e) => setFilterLiked(e.target.checked)}
                        />
                        <Heart />
                    </label>
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
                    <select
                        value={selectedSeller || ""}
                        onChange={(e) => setSelectedSeller(e.target.value)}
                    >
                        <option value="">All</option>
                        {uniqueSellers.map((seller) => (
                            <option key={seller} value={seller}>
                                {seller}
                            </option>
                        ))}
                    </select>
                </label>

                <label>
                    Condition:
                    <select
                        value={selectedCondition || ""}
                        onChange={(e) => setSelectedCondition(e.target.value)}
                    >
                        <option value="">All</option>
                        <option value="New">New</option>
                        <option value="OpenBox">OpenBox</option>
                        <option value="Used">Used</option>
                    </select>
                </label>
                <label>
                    Model:
                    <select
                        value={selectedModel || ""}
                        onChange={(e) => setSelectedModel(e.target.value)}
                    >
                        <option value="">All</option>
                        {uniqueModels.map((model) => (
                            <option key={model} value={model}>
                                {model}
                            </option>
                        ))}
                    </select>
                </label>

            </div>

            {filteredItems ?
                (<>
                    <h2 className={styles.found_items_count}>Found {filteredItems.length} items</h2>
                    <div className={styles.items_grid}>
                        {filteredItems.map((item, idx) => (
                            <ItemCard key={idx} item={item} />
                        ))}
                    </div>
                </>)
                : <h2>No items found</h2>
            }
        </div>
    )
}
