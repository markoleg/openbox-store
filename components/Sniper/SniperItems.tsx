'use client'
import { Loader } from 'lucide-react';
import styles from './SniperItems.module.css';
import SniperItem from './SniperItem';
import { SniperItemType } from '@/app/(home)/sniper/page';

export default function SniperItems({ items, onChanged }: { items?: SniperItemType[] | null; onChanged?: () => void }) {
    const allFavItems = items || [];
    if (!allFavItems) {
        return <Loader color='var(--primary)' className='loader' />;
    }

    return (<>
        {allFavItems.length > 0 ? (
            <div>
                <h2>Спостереження</h2>
                <br />
                <div className={styles.sniper_items}>
                    {allFavItems.map((item) => (
                        <SniperItem key={item.link} item={item} onChanged={onChanged} />
                    ))}
                </div>
            </div>
        ) : (
            <p>Спостережень поки немає.</p>
        )}
    </>
    )
}