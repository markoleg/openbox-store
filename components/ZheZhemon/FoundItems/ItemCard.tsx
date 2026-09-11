'use client'
import { Item } from "@/context/ItemsProvider";
import Image from "next/image";
import Link from "next/link";
import styles from "./FoundItems.module.css";
import { Ban, HeartPlus, History, Star } from "lucide-react";
import { HideButton, PauseButtons } from "@/components/ZheZhemon/HideControl/HideControl";
import { describeHide } from "@/lib/hideActions";
import { useReviewAction } from "@/components/ZheZhemon/Review/useReviewAction";
import type { ReviewTarget } from "@/lib/reviewClient";

/**
 * A catalog card. Every buyer action goes through the command API as an
 * explicit intent (set_like true/false, ban in THIS search, hide/pause) and is
 * journaled against the listing; the card has no notification context, so it
 * never claims a reaction time for any Telegram message. The star is a link to
 * the Sniper editor rather than a hidden toggle.
 */
export default function ItemCard({ item }: { item: Item }) {
    const target: ReviewTarget = { kind: 'listing', link: item.link, searchId: item.search_parameter_id };
    const { run, pending } = useReviewAction(target);
    const totalPrice = parseFloat((item.price + item.shipping_cost).toFixed(2));
    const sniperHref = `/sniper?${new URLSearchParams({ link: item.link, hint: `${item.condition} [${item.seller_name}] ${item.title}` })}`;
    const historyHref = `/zhezhemon/history?${new URLSearchParams({ link: item.link })}`;

    const handleBan = () => {
        if (!confirm("Забанити це оголошення в поточному пошуку?")) return;
        run('ban');
    };
    if (!item) return null
    return (
        <div className={`${styles.item_card} ${item.favorite ? styles.sniper : ''}`}>
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
                {item.hidden && (
                    <div className={styles.hide_mode}>
                        🙈 {describeHide(item.hidden_until)}
                    </div>
                )}
            </div>
            <div className={styles.item_count}>
                {item.count}
            </div>
            <div className={styles.btns_wrp}>
                <button onClick={() => run('set_like', { value: !item.liked })} disabled={!!pending} title={item.liked ? 'Зняти лайк' : 'Лайк'}>
                    <HeartPlus size={14}
                        style={{ fill: item.liked ? "red" : undefined }}
                    />
                </button>
                <HideButton target={target} hidden={item.hidden} />
                <button onClick={handleBan} disabled={!!pending} title="Забанити в цьому пошуку">
                    <Ban size={14} color="red" />
                </button>
                <Link href={sniperHref} title={item.favorite ? 'Sniper: редагувати спостереження' : 'Sniper: додати спостереження'}>
                    <Star size={14} className={styles.item_fav} fill={item.favorite ? 'yellow' : 'none'} />
                </Link>
                <Link href={historyHref} title="Картка та історія">
                    <History size={14} />
                </Link>
                <PauseButtons target={target} />
            </div>
        </div>
    )
}
