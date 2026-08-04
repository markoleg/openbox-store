import styles from './SniperItems.module.css';
import { useState } from "react";
import { Check, CheckCheck, Trash2, Zap, ZapOff } from "lucide-react";
import { supabase } from "@/lib/SupaBaseClient";
import Link from 'next/link';
import { SniperItemType } from '@/app/(home)/sniper/page';



export default function SniperItem({ item }: { item: SniperItemType }) {
    const [updatedItem, setUpdatedItem] = useState(false);
    const [visible, setVisible] = useState(true);
    const [desiredPrice, setDesiredPrice] = useState(item.desired_price || 0);
    const [description, setDescription] = useState(item.description || '');
    const [superFavorite, setSuperFavorite] = useState(!!item.super_favorite);

    if (!item) {
        return null;
    }
    if (!visible) {
        return null; // If the item is not visible, don't render it
    }
    return (
        <div className={styles.sniper_item} >
            <Link href={item.link} target="_blank" rel="noopener noreferrer" className={styles.sniper_item_link}>
                {item.link}
            </Link>
            <input type="text" name='description' id='description' value={description} onChange={(e) => setDescription(e.target.value)} />
            <div className={styles.sniper_item_header}>
                <input type="number" name="desired_price" id="desired_price" value={desiredPrice} onChange={(e) => setDesiredPrice(Number(e.target.value))} />
                <button
                    className={styles.sniper_button}
                    onClick={() => {
                        // set the items favorite status to false in the database table scraped_links
                        supabase.from('scraped_links')
                            .update({ favorite: false, super_favorite: false, desired_price: null, description: null, super_alerted_at: null })
                            .eq('link', item.link)
                            .then(({ error }) => {
                                if (error) {
                                    console.error("Error updating favorite status:", error);
                                } else {
                                    setVisible(false);
                                }
                            })
                    }}
                >
                    <Trash2 />
                </button>
                <button
                    className={styles.sniper_button}
                    title={superFavorite ? 'Супер-товар: буде дзвінок' : 'Зробити супер-товаром'}
                    onClick={() => {
                        // super_favorite escalates to a phone call when the price hits target
                        const next = !superFavorite;
                        supabase.from('scraped_links')
                            .update({ super_favorite: next, super_alerted_at: null })
                            .eq('link', item.link)
                            .then(({ error }) => {
                                if (error) {
                                    console.error("Error updating super favorite:", error);
                                } else {
                                    setSuperFavorite(next);
                                }
                            })
                    }}
                >
                    {superFavorite ? <Zap /> : <ZapOff />}
                </button>
                <button
                    className={styles.sniper_button}
                    onClick={() => {
                        // update the desired price in the database table scraped_links
                        try {
                            supabase.from('scraped_links')
                                // a new target price is a new deal — let it escalate again
                                .update({ desired_price: parseFloat(desiredPrice.toString()), description: description === '' ? null : description, super_alerted_at: null })
                                .eq('link', item.link)
                                .then(({ error }) => {
                                    if (error) {
                                        console.error("Error updating desired price:", error);
                                    } else {
                                        setUpdatedItem(true);
                                    }
                                });
                        } catch (error) {
                            console.error("Unexpected error:", error);
                        }
                    }}
                >
                    {updatedItem ?
                        <CheckCheck />
                        : <Check />
                    }
                </button>
            </div>

        </div>
    )
}