'use client'
import { useEffect, useState } from "react";
import { supabase } from "@/lib/SupaBaseClient"; // Assuming you have a Supabase client setup



export interface Search {
	id: number;
	categoryid: string;
	keywords: number;
	model: string;
	condition: number;
	minprice: number;
	maxprice: number;
	brand: string;
	rate: number;
	banned: string[];
	seller: string;
	more_aspects: string[];
}

export function useRealtimeSearches(searchId?: number) {
	const [searches, setSearches] = useState<Search[]>([]);

	useEffect(() => {

		const fetchInitial = async () => {
			let query = supabase
				.from("searchparameters")
				.select("*")
				.order("id", { ascending: true });

			if (searchId !== undefined) {
				query = query.eq("id", searchId);
			}

			const { data, error } = await query;

			if (data) {
				setSearches(data);
			}
		};

		fetchInitial();

		const channel = supabase
			.channel(`realtime-searches-${searchId ? searchId : 'all'}`)
			.on(
				"postgres_changes",
				{
					event: "INSERT",
					schema: "public",
					table: "searchparameters",
					...(searchId && { filter: `id=eq.${searchId}` }),
				},
				(payload) => {
					setSearches((prev) => [payload.new as Search, ...prev]);
				}
			)
			.on(
				"postgres_changes",
				{
					event: "UPDATE",
					schema: "public",
					table: "searchparameters",
					...(searchId && { filter: `id=eq.${searchId}` }),
				},
				(payload) => {
					setSearches((prev) =>
						prev.map((item) =>
							item.id === payload.new.id ? { ...item, ...payload.new } : item
						)
					);
				}
			)
			.on(
				"postgres_changes",
				{
					event: "DELETE",
					schema: "public",
					table: "searchparameters",
					...(searchId && { filter: `id=eq.${searchId}` }),
				},
				(payload) => {
					setSearches((prev) =>
						prev.filter((item) => item.id !== Number(payload.old.id))
					);
				}
			)
			.subscribe();

		return () => {
			supabase.removeChannel(channel);
		};
	}, [searchId]);

	return searches;
}
