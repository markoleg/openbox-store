'use client'
import Link from "next/link";
import styles from "./FoundItems.module.css";
import { Ban, EyeOff } from "lucide-react";
import { supabase } from "@/lib/SupaBaseClient";
import { ShopItem } from "@/context/ShopItemsProvider";

export default function ShopItemCard({ item }: { item: ShopItem }) {
    const handleHide = async () => {
        const newHidden = !item.hidden;
        const patch: Record<string, unknown> = { hidden: newHidden };
        if (newHidden) patch.hide_price_threshold = item.price; // resurface when cheaper
        const { error } = await supabase.from('shop_seen').update(patch).eq('link', item.link);
        if (error) console.error("Error hiding item:", error);
    };

    const handleBan = async () => {
        if (!confirm("Are you sure you want to ban this item?")) return;
        const { error: banErr } = await supabase.from('shop_seen').update({ banned: true }).eq('link', item.link);
        if (banErr) { console.error("Error banning item:", banErr); return; }
        // remove from the current snapshot so it disappears now
        await supabase.from('shop_products').delete().eq('link', item.link);
    };

    if (!item) return null;
    return (
        <div className={styles.item_card}>
            <Link href={item.link} target="_blank" rel="noopener noreferrer">
                {/* plain img: shop.app images come from cdn.shopify.com (no next/image domain config needed) */}
                <img
                    src={item.image_url || '/images/placeholder.png'}
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
                </h2>
                <div className={styles.item_price}>
                    ${item.price}
                </div>
                <div>
                    <small>{item.seller}</small>
                </div>
            </div>
            <div className={styles.btns_wrp}>
                <button onClick={handleHide} title={item.hidden ? "Unhide" : "Hide until cheaper"}>
                    <EyeOff size={14} color="yellow" />
                </button>
                <button onClick={handleBan} title="Ban forever">
                    <Ban size={14} color="red" />
                </button>
            </div>
        </div>
    );
}
