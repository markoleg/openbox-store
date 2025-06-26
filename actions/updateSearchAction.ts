"use server";

import { supabase } from "@/lib/SupaBaseClient";

export async function updateSearch(formData: FormData) {
	const id = formData.get("id");
	const categoryid = formData.get("categoryid");
	const keywords = formData.get("keywords");
	const brand = formData.get("brand");
	const model = formData.get("model") === "" ? null : formData.get("model");
	const condition = formData.get("condition");
	const minprice = formData.get("minprice");
	const maxprice = formData.get("maxprice");
	const rate = formData.get("rate");
	const seller = formData.get("seller") === "" ? null : formData.get("seller");

	// Збираємо more_aspects
	const aspectEntries: string[] = [];
	let aspectIndex = 0;
	while (formData.has(`aspect_key_${aspectIndex}`)) {
		const key = formData.get(`aspect_key_${aspectIndex}`)?.toString().trim();
		const value = formData
			.get(`aspect_value_${aspectIndex}`)
			?.toString()
			.trim();

		if (key && value) {
			aspectEntries.push(`${key}:${value}`);
		}
		aspectIndex++;
	}
	const more_aspects = aspectEntries.length > 0 ? aspectEntries : null;

	const bannedLinks: string[] = [];
	let bannedIndex = 0;
	while (formData.has(`banned_link_${bannedIndex}`)) {
		const link = formData.get(`banned_link_${bannedIndex}`)?.toString().trim();
		if (link) {
			bannedLinks.push(link);
		}
		bannedIndex++;
	}

	const banned = bannedLinks.length > 0 ? bannedLinks : null;

	const { error } = await supabase
		.from("searchparameters")
		.update({
			categoryid,
			keywords,
			brand,
			model,
			condition,
			minprice,
			maxprice,
			rate,
			seller,
			more_aspects,
			banned,
		})
		.eq("id", id);

	if (error) {
		console.error("Update failed:", error);
	}
}
