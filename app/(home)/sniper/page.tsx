'use client'
import { addNewSniperItem } from "@/actions/addNewSniperItem";
import SniperItems from "@/components/Sniper/SniperItems";
import { supabase } from "@/lib/SupaBaseClient";
import styles from '@/components/Sniper/SniperItems.module.css';
import { useEffect, useState } from "react";



export default function SniperPage() {
    const [favItems, setFavItems] = useState<any[]>([]);

    useEffect(() => {
        const fetchFavoriteItems = async () => {
            const { data } = await supabase
                .from('scraped_links')
                .select('*')
                .eq('favorite', true)
            setFavItems(data ?? []);
        };
        fetchFavoriteItems();
    }, []);




    return (
        <>
            <main className='content'>
                <h1>Sniper Page</h1>
                <p>This is the sniper page where you can manage your sniper settings and items.</p>
                <br />
                {/* form to add new item to the scraped_links table */}
                <form
                    action={async (formData) => {
                        await addNewSniperItem(formData); // серверна дія
                        window.location.reload(); // тригер перезавантаження
                    }}
                    className={styles.sniper_form}>
                    <div>
                        <label htmlFor="itemLink">Item Link:</label>
                        <input type="text" id="itemLink" name="link" required />
                    </div>
                    <div>
                        <label htmlFor="itemDesiredPrice">Desired Price:</label>
                        <input type="number" id="itemDesiredPrice" name="desired_price" required />
                    </div>
                    <button type="submit" className={styles.sniper_form_button}>Add Item</button>

                </form>
                <br />
                <SniperItems items={favItems} />
            </main>
        </>
    );
}