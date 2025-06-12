'use client'
import { Loader } from 'lucide-react';
import styles from './SniperItems.module.css';
import SniperItem from './SniperItem';

export default function SniperItems({ items }: { items?: any[] | null }) {
    const allFavItems = items || [];
    if (!allFavItems) {
        return <Loader color='var(--primary)' className='loader' />;
    }

    return (<>
        {allFavItems.length > 0 ? (
            <div>
                <h2>Favorite Items</h2>
                <br />
                <div className={styles.sniper_items}>
                    {allFavItems.map((item, index) => (
                        <SniperItem key={index} item={item} />
                    ))}
                </div>
            </div>
        ) : (
            <p>No favorite items found.</p>
        )}
    </>
    )
}