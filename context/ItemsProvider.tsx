'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ItemsContext, type Item, type LivePatch } from '@/context/itemsContext'
import { supabase } from "@/lib/SupaBaseClient";
import { toast } from "react-toastify";
import ReviewToast, { type ToastEvent } from '@/components/ZheZhemon/Review/ReviewToast';

export type { Item, LivePatch } from '@/context/itemsContext'
export { useItems, useItemsLoading, usePatchLink } from '@/context/itemsContext'

/**
 * The catalog list and the notification toasts.
 *
 * The list follows `items` in realtime as before. Toasts do NOT: they come from
 * `notification_toasts`, one row per causal event written by the tracker after
 * its stock preflight decided to send. A live update of a card (owner transfer,
 * like, a technical column) therefore never rings, and OUT_OF_STOCK candidates
 * never surface here. Buyer actions on a toast carry the event context.
 */
export function ItemsProvider({ children }: { children: React.ReactNode }) {
    const [items, setItems] = useState<Item[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const seenEvents = useRef(new Set<string>())
    useEffect(() => {
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission !== 'granted') {
            Notification.requestPermission();
        }
    }, []);

    const patchLink = useCallback((link: string, patch: LivePatch) => {
        setItems(prev => prev.map(item => item.link === link ? { ...item, ...patch } : item))
    }, [])

    useEffect(() => {
        const fetchInitial = async () => {
            const { data } = await supabase
                .from('items').select(`*, scraped_links(count, favorite, desired_price, hidden_until)`)
                .order("total_price", { ascending: true });
            if (data) {
                const withCount = data.map((item: any) => ({
                    ...item,
                    count: item.scraped_links?.count ?? 0,
                    favorite: item.scraped_links?.favorite ?? false,
                    desired_price: item.scraped_links?.desired_price ?? 0,
                    hidden_until: item.scraped_links?.hidden_until ?? null,
                }))
                setItems(withCount)
            }
            setIsLoading(false)
        }

        fetchInitial()

        const playNotificationSound = () => {
            const audio = new Audio("/sounds/notification.mp3"); // шлях до файлу в public/
            audio.play().catch(e => console.warn("Can't play sound:", e));
        };

        const channel = supabase.channel('items-global')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'items' },
                (payload) => {
                    const fresh = payload.new as Item
                    setItems((prev) => prev.some(item => item.id === fresh.id) ? prev : [fresh, ...prev])
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'items' },
                (payload) => {
                    const updatedItem = payload.new as Item;
                    setItems((prev) => {
                        const exists = prev.find((item) => item.id === updatedItem.id);
                        if (exists) {
                            return prev.map((item) =>
                                item.id === updatedItem.id ? { ...item, ...updatedItem } : item
                            );
                        }
                        return [updatedItem, ...prev];
                    });
                }
            )
            .on(
                'postgres_changes',
                { event: 'DELETE', schema: 'public', table: 'items' },
                (payload) => {
                    setItems((prev) => prev.filter((item) => item.id !== Number(payload.old.id)))
                }
            )
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'notification_toasts' },
                (payload) => {
                    const event = payload.new as ToastEvent
                    // One toast per event in this tab, whatever realtime redelivers.
                    if (!event?.event_id || seenEvents.current.has(event.event_id)) return
                    seenEvents.current.add(event.event_id)
                    toast.info(<ReviewToast event={event} />, {
                        toastId: `event:${event.event_id}`,
                        className: "custom-toast",
                        progressClassName: "Toastify__progress-bar",
                        closeOnClick: false,
                    });
                    playNotificationSound();
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    return (
        <ItemsContext.Provider value={{ items, isLoading, patchLink }}>
            {children}
        </ItemsContext.Provider>
    )
}

