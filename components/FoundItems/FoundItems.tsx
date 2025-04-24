'use client'
import { useItems, useItemsLoading } from '@/context/ItemsProvider'
import ItemCard from "./ItemCard"
import styles from "./FoundItems.module.css";
import { Loader } from 'lucide-react';

export default function FoundItems({ id }: { id: number | undefined }) {

    const items = id === undefined ? useItems() : useItems().filter(item => Number(item.search_parameter_id) === Number(id))
    const loading = useItemsLoading()

    if (loading) return <Loader color='var(--primary)' className='loader' />

    if (!items || items.length === 0) {
        return <div>No items found</div>
    }
    return (
        <div>
            <h1>Found {items.length} items</h1>
            <div className={styles.items_grid}>

                {items.map((item: any, idx: number) => {
                    return (
                        <ItemCard key={idx} item={item} />
                    )
                })}
            </div>
        </div>
    )
}