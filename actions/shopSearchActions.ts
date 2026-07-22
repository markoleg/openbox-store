"use server";

import { supabase } from "@/lib/SupaBaseClient";

function collectList(formData: FormData, prefix: string): string[] {
	const out: string[] = [];
	let i = 0;
	while (formData.has(`${prefix}_${i}`)) {
		const v = formData.get(`${prefix}_${i}`)?.toString().trim();
		if (v) out.push(v);
		i++;
	}
	return out;
}

function num(formData: FormData, key: string): number | null {
	const v = formData.get(key);
	if (v === null || v.toString().trim() === "") return null;
	const n = Number(v);
	return Number.isNaN(n) ? null : n;
}

export async function addShopSearch(formData: FormData) {
	const { error } = await supabase.from("shop_searches").insert({
		query: formData.get("query"),
		min_price: num(formData, "min_price"),
		max_price: num(formData, "max_price"),
		rate: num(formData, "rate") ?? 1800,
		enabled: formData.get("enabled") === "on",
		banned_sellers: collectList(formData, "banned_seller"),
		stop_words: collectList(formData, "stop_word"),
	});
	if (error) console.error("Insert shop_search failed:", error);
}

export async function updateShopSearch(formData: FormData) {
	const id = formData.get("id");
	const { error } = await supabase
		.from("shop_searches")
		.update({
			query: formData.get("query"),
			min_price: num(formData, "min_price"),
			max_price: num(formData, "max_price"),
			rate: num(formData, "rate") ?? 1800,
			enabled: formData.get("enabled") === "on",
			banned_sellers: collectList(formData, "banned_seller"),
			stop_words: collectList(formData, "stop_word"),
		})
		.eq("id", id);
	if (error) console.error("Update shop_search failed:", error);
}

export async function deleteShopSearch(searchId: number) {
	const { error } = await supabase.from("shop_searches").delete().eq("id", searchId);
	if (error) console.error("Delete shop_search failed:", error);
}
