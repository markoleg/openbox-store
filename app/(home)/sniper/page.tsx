'use client'
import { Suspense } from 'react';
import { addNewSniperItem } from "@/actions/addNewSniperItem";
import SniperItems from "@/components/Sniper/SniperItems";
import { supabase } from "@/lib/SupaBaseClient";
import styles from '@/components/Sniper/SniperItems.module.css';
import { useEffect, useState } from "react";

function SniperForm() {
    const [favItems, setFavItems] = useState<any[]>([]);
    const [searchParams, setSearchParams] = useState<{ itemLink: string; itemDescription: string }>({
        itemLink: '',
        itemDescription: ''
    });

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        setSearchParams({
            itemLink: params.get('itemLink') ?? '',
            itemDescription: params.get('itemDescription') ?? ''
        });
    }, []);

    useEffect(() => {
        const fetchFavoriteItems = async () => {
            const { data } = await supabase
                .from('scraped_links')
                .select('*')
                .eq('favorite', true)
                .order('desired_price', { ascending: true });
            setFavItems(data ?? []);
        };
        fetchFavoriteItems();
    }, []);

    return (
        <>
            <form
                action={async (formData) => {
                    await addNewSniperItem(formData);
                    window.location.reload();
                }}
                className={styles.sniper_form}>
                <div>
                    <label htmlFor="itemLink">Item Link:</label>
                    <input type="text" id="itemLink" name="link" required defaultValue={searchParams.itemLink} />
                </div>
                <div>
                    <label htmlFor="itemDescription">Description:</label>
                    <input type="text" id="itemDescription" name="description" defaultValue={searchParams.itemDescription} />
                </div>
                <div>
                    <label htmlFor="itemDesiredPrice">Desired Price:</label>
                    <input type="number" id="itemDesiredPrice" name="desired_price" required />
                </div>
                <button type="submit" className={styles.sniper_form_button}>Add Item</button>
            </form>
            <br />
            <SniperItems items={favItems} />
        </>
    );
}

export default function SniperPage() {
    return (
        <main className='content'>
            <h1>Sniper Page</h1>
            <p>This is the sniper page where you can manage your sniper settings and items.</p>
            <br />
            <Suspense fallback={<div>Loading...</div>}>
                <SniperForm />
            </Suspense>
        </main>
    );
}
