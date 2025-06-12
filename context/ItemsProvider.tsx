'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from "@/lib/SupaBaseClient";
import { toast } from "react-toastify";
import { Ban, EyeOff } from 'lucide-react';


export interface Item {
    id: number;
    search_parameter_id: number;
    title: string;
    model: string;
    price: number;
    link: string;
    seller_name: string;
    feedback_score: number;
    feedback_percentage: number;
    shipping_cost: number;
    image_url: string;
    hidden: boolean;
    more_aspects: string[];
    liked: boolean;
    condition: string;
    count?: number; // додаємо поле count
    favorite?: boolean; // додаємо поле favorite
    desired_price?: number | null; // додаємо поле desired_price
}
interface ItemsContextType {
    items: Item[]
    isLoading: boolean
}

const handleBan = async (item: Item) => {
    // ask the user for confirmation before banning the item
    const confirmBan = confirm("Are you sure you want to ban this item?");

    if (!confirmBan) {
        return;
    }
    try {
        const { error: hideError } = await supabase
            .from('items')
            .update({ hidden: true })
            .eq('id', item.id);

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
const handleHide = (item: Item) => {
    // update the hidden status in the database
    supabase
        .from('items')
        .update({ hidden: !item.hidden })
        .eq('id', item.id)
        .then(({ error }) => {
            if (error) {
                console.error("Error updating item:", error);
            } else {
                // Update the local state or refetch items if necessary
            }
        });
}

const ItemsContext = createContext<ItemsContextType>({ items: [], isLoading: true })

export function ItemsProvider({ children }: { children: React.ReactNode }) {
    const [items, setItems] = useState<Item[]>([])
    const [isLoading, setIsLoading] = useState(true)
    useEffect(() => {
        if (typeof window !== 'undefined' && Notification && Notification.permission !== 'granted') {
            Notification.requestPermission();
            console.log("Notification permission requested");

        }
    }, []);

    // const notifySystem = (title: string, body: string, link: string) => {
    //     if (Notification.permission === 'granted') {
    //         console.log("Notification permission granted");

    //         const notification = new Notification(title, {
    //             body,
    //             icon: '/icons/icon-192x192.png',
    //         });
    //         notification.onclick = () => {
    //             window.open(link, '_blank');
    //         };
    //     }
    // };
    useEffect(() => {
        const fetchInitial = async () => {
            const { data } = await supabase
                .from('items').select(`*, scraped_links(count, favorite, desired_price)`)
                .order("total_price", { ascending: true });
            if (data) {
                const withCount = data.map((item: any) => ({
                    ...item,
                    count: item.scraped_links?.count ?? 0,
                    favorite: item.scraped_links?.favorite ?? false,
                    desired_price: item.scraped_links?.desired_price ?? 0,
                }))
                setItems(withCount)
            }
            setIsLoading(false)
        }

        fetchInitial()

        const channel = supabase.channel('items-global')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'items' },
                (payload) => {
                    const totalPrice = ((payload.new as Item).price + (payload.new as Item).shipping_cost).toFixed(2)
                    setItems((prev) => [payload.new as Item, ...prev])
                    const playNotificationSound = () => {
                        const audio = new Audio("/sounds/notification.mp3"); // шлях до файлу в public/
                        audio.play().catch(e => console.warn("Can't play sound:", e));
                    };

                    toast.info(
                        <p>
                            NEW:{" "}
                            <a
                                href={(payload.new as Item).link}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: "#00d084", textDecoration: "underline" }}
                            >
                                {(payload.new as Item).title}
                            </a>
                            <br />
                            <b>
                                {(payload.new as Item).condition}
                            </b>
                            {" "}
                            <span style={{ color: 'var(--primary)' }}>
                                for <b>
                                    ${totalPrice}
                                </b>
                            </span>
                            {" "}
                            <span style={{ color: 'var(--bg-gray-o70)' }}>
                                {(payload.new as Item).shipping_cost > 0
                                    ? `($${payload.new.shipping_cost} shipping)`
                                    : ""}
                            </span>
                            <br />
                            <span>
                                <b>
                                    {(payload.new as Item).seller_name}
                                </b>
                                {' '}
                                <span>
                                    {'('}{payload.new.feedback_score}{')'} {payload.new.feedback_percentage}%
                                </span>
                            </span>
                            <br />
                            <button onClick={async () => handleBan(payload.new as Item)} className='ban_btn'>
                                <Ban size={14} color="red" />
                            </button>
                            <button onClick={() => handleHide(payload.new as Item)} className='hide_btn'>
                                <EyeOff size={14} color="yellow" />
                            </button>
                        </p>,
                        {
                            className: "custom-toast",
                            progressClassName: "Toastify__progress-bar",
                        }
                    );
                    playNotificationSound();
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'items' },
                (payload) => {
                    const updatedItem = payload.new as Item;
                    const oldPrice = payload.old?.price
                    const newPrice = payload.new?.price
                    const totalPrice = ((payload.new as Item).price + (payload.new as Item).shipping_cost).toFixed(2)
                    setItems((prev) => {
                        const exists = prev.find((item) => item.id === updatedItem.id);
                        if (exists) {
                            return prev.map((item) =>
                                item.id === updatedItem.id ? { ...item, ...updatedItem } : item
                            );
                        } else {
                            return [updatedItem, ...prev];
                        }
                    });


                    if (oldPrice !== newPrice) {
                        toast.info(
                            <p>
                                UPDATED:{" "}
                                <a
                                    href={(payload.new as Item).link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ color: "#00d084", textDecoration: "underline" }}
                                >
                                    {(payload.new as Item).title}
                                </a>
                                <br />
                                <b>
                                    {(payload.new as Item).condition}
                                </b>
                                {" "}
                                <span style={{ color: 'var(--primary)' }}>
                                    for <b>
                                        ${totalPrice}
                                    </b>
                                </span>
                                {" "}
                                <span style={{ color: 'var(--bg-gray-o70)' }}>
                                    {(payload.new as Item).shipping_cost > 0
                                        ? `($${payload.new.shipping_cost} shipping)`
                                        : ""}
                                </span>
                                <br />
                                <span>
                                    <b>
                                        {(payload.new as Item).seller_name}
                                    </b>
                                    {' '}
                                    <span>
                                        {'('}{payload.new.feedback_score}{')'} {payload.new.feedback_percentage}%
                                    </span>
                                </span>
                                <br />
                                <button onClick={async () => handleBan(payload.new as Item)} className='ban_btn'>
                                    <Ban size={14} color="red" />
                                </button>
                                <button onClick={() => handleHide(payload.new as Item)} className='hide_btn'>
                                    <EyeOff size={14} color="yellow" />
                                </button>
                            </p>,
                            {
                                className: "custom-toast",
                                progressClassName: "Toastify__progress-bar",
                            }
                        )
                        const playNotificationSound = () => {
                            const audio = new Audio("/sounds/notification.mp3"); // шлях до файлу в public/
                            audio.play().catch(e => console.warn("Can't play sound:", e));
                        };
                        playNotificationSound();
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: 'DELETE', schema: 'public', table: 'items' },
                (payload) => {
                    setItems((prev) => prev.filter((item) => item.id !== Number(payload.old.id)))
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    return (
        <ItemsContext.Provider value={{ items, isLoading }}>
            {children}
        </ItemsContext.Provider>
    )
}

export function useItems() {
    return useContext(ItemsContext).items
}
export function useItemsLoading() {
    const ctx = useContext(ItemsContext)
    return ctx.isLoading
}
