'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from "@/lib/SupaBaseClient";
import { toast } from "react-toastify";


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
    count?: number // додаємо поле count
}
interface ItemsContextType {
    items: Item[]
    isLoading: boolean
}

const ItemsContext = createContext<ItemsContextType>({ items: [], isLoading: true })

export function ItemsProvider({ children }: { children: React.ReactNode }) {
    const [items, setItems] = useState<Item[]>([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const fetchInitial = async () => {
            const { data } = await supabase
                .from('items').select(`*, scraped_links(count)`)
                .eq('hidden', false)
                .order("price", { ascending: true });
            if (data) {
                const withCount = data.map((item: any) => ({
                    ...item,
                    count: item.scraped_links?.count ?? 0
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
                                    ? `(${payload.new.shipping_cost} shipping)`
                                    : ""}
                            </span>
                            <br />
                            <span>
                                <b>
                                    {(payload.new as Item).seller_name}
                                </b>
                                {' '}
                                <span>
                                    {payload.new.feedback_percentage}%{'('}{payload.new.feedback_score}{')'}
                                </span>
                            </span>
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

                    if (updatedItem.hidden) {
                        setItems((prev) => prev.filter((item) => item.id !== updatedItem.id));
                        return;
                    }

                    setItems((prev) =>
                        prev.map((item) =>
                            item.id === updatedItem.id ? { ...item, ...updatedItem } : item
                        )
                    );
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
                                        ${(payload.new as Item).price}
                                    </b>
                                </span>
                                {" "}
                                <span style={{ color: 'var(--bg-gray-o70)' }}>
                                    {(payload.new as Item).shipping_cost > 0
                                        ? `(${payload.new.shipping_cost} shipping)`
                                        : ""}
                                </span>
                                <br />
                                <span>
                                    <b>
                                        {(payload.new as Item).seller_name}
                                    </b>
                                    {' '}
                                    <span>
                                        {payload.new.feedback_percentage}%{'('}{payload.new.feedback_score}{')'}
                                    </span>
                                </span>
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
