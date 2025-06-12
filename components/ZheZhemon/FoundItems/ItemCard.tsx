'use client'
import { Item } from "@/context/ItemsProvider";
import Image from "next/image";
import Link from "next/link";
import styles from "./FoundItems.module.css";
import { Ban, EyeOff, HeartPlus, Star } from "lucide-react";
import { supabase } from "@/lib/SupaBaseClient";
import { useState } from "react";



export default function ItemCard({ item }: { item: Item }) {
    const [snip, setSnip] = useState(item.favorite);

    const itemId = item.id;
    const totalPrice = parseFloat((item.price + item.shipping_cost).toFixed(2));
    const handleLike = () => {
        // update the liked status in the database
        supabase
            .from('items')
            .update({ liked: !item.liked })
            .eq('id', itemId)
            .then(({ error }) => {
                if (error) {
                    console.error("Error updating item:", error);
                } else {
                    // Update the local state or refetch items if necessary
                }
            });
    }
    const handleHide = () => {
        // update the hidden status in the database
        supabase
            .from('items')
            .update({ hidden: !item.hidden })
            .eq('id', itemId)
            .then(({ error }) => {
                if (error) {
                    console.error("Error updating item:", error);
                } else {
                    // Update the local state or refetch items if necessary
                }
            });
    }
    const handleBan = async () => {
        // ask the user for confirmation before banning the item
        const confirmBan = confirm("Are you sure you want to ban this item?");

        if (!confirmBan) {
            return;
        }
        try {
            const { error: hideError } = await supabase
                .from('items')
                .update({ hidden: true })
                .eq('id', itemId);

            if (hideError) {
                console.error("Error hiding item:", hideError);
                return;
            }

            const { data: searchParamData, error: fetchError } = await supabase
                .from('searchparameters')
                .select('banned')
                .eq('id', item.search_parameter_id)
                .single();

            if (fetchError) {
                console.error("Error fetching search parameter:", fetchError);
                return;
            }

            let bannedList: string[] = [];

            if (searchParamData?.banned) {
                bannedList = Array.isArray(searchParamData.banned)
                    ? searchParamData.banned
                    : [];
            }

            if (!bannedList.includes(item.link)) {
                bannedList.push(item.link);
            }

            const { error: updateError } = await supabase
                .from('searchparameters')
                .update({ banned: bannedList })
                .eq('id', item.search_parameter_id);

            if (updateError) {
                console.error("Error updating banned list:", updateError);
            }
        } catch (error) {
            console.error("Unexpected error:", error);
        }
    };
    const handleFav = () => {
        // update the fav status in the database in scraped_links table
        supabase
            .from('scraped_links')
            .update({ favorite: !item.favorite })
            .eq('link', item.link)
            .then(({ error }) => {
                if (error) {
                    console.error("Error updating item:", error);
                } else {
                    // Update the local state or refetch items if necessary
                    setSnip(!snip);
                }
            });
    }
    if (!item) return null
    return (
        <div className={styles.item_card}>
            <Link href={item.link} target="_blank" rel="noopener noreferrer">
                <Image
                    src={item.image_url !== 'No image' ? item.image_url : '/images/placeholder.png'}
                    alt={item.title}
                    width={100}
                    height={100}
                    className={styles.item_image}
                />
            </Link>

            <div className={styles.item_info}>
                <h2 className={styles.item_title}>
                    <Link href={item.link} target="_blank" rel="noopener noreferrer">
                        {item.title}
                    </Link>
                    <small className={`${styles.item_condition} ${item.condition === 'New' ? styles.new : item.condition === 'OpenBox' ? styles.open_box : styles.used}`}>
                        ({item.condition})
                    </small>
                </h2>
                <div className={styles.item_price}>
                    ${totalPrice}
                    {item.shipping_cost > 0 && <small className={styles.item_shipping_cost}> (${item.shipping_cost} shipping)</small>}
                </div>
                <div>
                    <small>{item.seller_name} ({item.feedback_score}) {item.feedback_percentage}%
                    </small>
                </div>
            </div>
            <div className={styles.item_count}>
                {item.count}
            </div>
            <div className={styles.btns_wrp}>
                <button onClick={handleLike}>
                    <HeartPlus size={14}
                        style={{ fill: item.liked ? "red" : undefined }}
                    />
                </button>
                <button onClick={handleHide}>
                    <EyeOff size={14} color="yellow" />
                </button>
                <button onClick={handleBan}>
                    <Ban size={14} color="red" />
                </button>
                <button onClick={handleFav}>

                    <Star size={14} className={styles.item_fav} fill={snip ? 'yellow' : 'none'} />
                </button >

            </div>
        </div>
    )
}
