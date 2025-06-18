import styles from './SniperItems.module.css';
import { useState } from "react";
import { Check, CheckCheck, Trash2 } from "lucide-react";
import { supabase } from "@/lib/SupaBaseClient";
import Link from 'next/link';

export default function SniperItem({ item }: { item: any }) {
    const [updatedItem, setUpdatedItem] = useState(false);
    const [visible, setVisible] = useState(true);
    const [desiredPrice, setDesiredPrice] = useState(item.desired_price || 0);
    const [description, setDescription] = useState(item.description || '');

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
            <input type="text" name='description' id='description' value={item.description} onChange={(e) => setDescription(e.target.value)} />
            <div className={styles.sniper_item_header}>
                <button
                    className={styles.sniper_button}
                    onClick={() => {
                        // set the items favorite status to false in the database table scraped_links
                        supabase.from('scraped_links')
                            .update({ favorite: false, desired_price: null })
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
                <input type="text" name="desired_price" id="desired_price" value={desiredPrice} onChange={(e) => setDesiredPrice(Number(e.target.value))} />
                <button
                    className={styles.sniper_button}
                    onClick={() => {
                        // update the desired price in the database table scraped_links
                        try {
                            supabase.from('scraped_links')
                                .update({ desired_price: parseFloat(desiredPrice.toString()), description: description === '' ? null : description })
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