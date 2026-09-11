'use client'
import { createContext, useContext } from 'react'

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
    hidden_until?: string | null; // з scraped_links: термін паузи, якщо є
}
/** Fields of scraped_links a command result reports back for the same link. */
export type LivePatch = Partial<Pick<Item, 'favorite' | 'desired_price' | 'hidden_until' | 'liked'>>;
export interface ItemsContextType {
    items: Item[]
    isLoading: boolean
    patchLink: (link: string, patch: LivePatch) => void
}

export const ItemsContext = createContext<ItemsContextType>({ items: [], isLoading: true, patchLink: () => { } })

export function useItems() {
    return useContext(ItemsContext).items
}
export function useItemsLoading() {
    return useContext(ItemsContext).isLoading
}
/** scraped_links is not in realtime; commands report the live row back instead. */
export function usePatchLink() {
    return useContext(ItemsContext).patchLink
}
