'use client'
import { useEffect, useState } from "react";
import { supabase } from "@/lib/SupaBaseClient";

export interface ShopSearch {
	id: number;
	query: string;
	min_price: number | null;
	max_price: number | null;
	banned_sellers: string[];
	stop_words: string[];
	enabled: boolean;
	rate: number;
}

export function useRealtimeShopSearches(searchId?: number) {
	const [searches, setSearches] = useState<ShopSearch[]>([]);

	useEffect(() => {
		const fetchInitial = async () => {
			let query = supabase
				.from("shop_searches")
				.select("*")
				.order("id", { ascending: true });

			if (searchId !== undefined) {
				query = query.eq("id", searchId);
			}

			const { data } = await query;
			if (data) setSearches(data as ShopSearch[]);
		};

		fetchInitial();

		const channel = supabase
			.channel(`realtime-shop-searches-${searchId ? searchId : "all"}`)
			.on(
				"postgres_changes",
				{ event: "INSERT", schema: "public", table: "shop_searches", ...(searchId && { filter: `id=eq.${searchId}` }) },
				(payload) => setSearches((prev) => [...prev, payload.new as ShopSearch])
			)
			.on(
				"postgres_changes",
				{ event: "UPDATE", schema: "public", table: "shop_searches", ...(searchId && { filter: `id=eq.${searchId}` }) },
				(payload) =>
					setSearches((prev) =>
						prev.map((s) => (s.id === (payload.new as ShopSearch).id ? { ...s, ...(payload.new as ShopSearch) } : s))
					)
			)
			.on(
				"postgres_changes",
				{ event: "DELETE", schema: "public", table: "shop_searches", ...(searchId && { filter: `id=eq.${searchId}` }) },
				(payload) => setSearches((prev) => prev.filter((s) => s.id !== Number(payload.old.id)))
			)
			.subscribe();

		return () => {
			supabase.removeChannel(channel);
		};
	}, [searchId]);

	return searches;
}
