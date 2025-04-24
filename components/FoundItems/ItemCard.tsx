import { Item } from "@/context/ItemsProvider";
import Image from "next/image";
import Link from "next/link";
import styles from "./FoundItems.module.css";
import { Ban, EyeOff, HeartPlus } from "lucide-react";


export default function ItemCard({ item }: { item: Item }) {
    return (
        <div className={styles.item_card}>
            <Link href={item.link}>
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
                    <Link href={item.link}>
                        {item.title}
                    </Link>
                    <small className={`${styles.item_condition} ${item.condition === 'New' ? styles.new : item.condition === 'OpenBox' ? styles.open_box : styles.used}`}>
                        ({item.condition})
                    </small>
                </h2>
                <div className={styles.item_price}>
                    ${item.price + item.shipping_cost}
                    {item.shipping_cost > 0 && <small className={styles.item_shipping_cost}> (${item.shipping_cost} shipping)</small>}
                </div>
                <div>
                    <small>{item.seller_name} {item.feedback_percentage}% ({item.feedback_score})
                    </small>
                </div>
            </div>
            <div className={styles.item_count}>
                {item.count}
            </div>
            <div className={styles.btns_wrp}>
                <button>
                    <HeartPlus size={14} />
                </button>
                <button>
                    <EyeOff size={14} color="yellow" />
                </button>
                <button>
                    <Ban size={14} color="red" />
                </button>
            </div>
        </div>
    )
}
