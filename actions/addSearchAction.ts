"use server";

import { supabase } from "@/lib/SupaBaseClient";

/** The filters object off the form, or undefined when it cannot be trusted. */
function parseFilters(raw: FormDataEntryValue | null) {
	if (typeof raw !== "string" || raw === "") return undefined;
	try {
		const parsed = JSON.parse(raw);
		if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
			return parsed;
		}
		console.error("Ignoring non-object filters payload:", raw);
	} catch (e) {
		console.error("Ignoring unparsable filters payload:", raw, e);
	}
	return undefined;
}

export async function addSearch(formData: FormData) {
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

	// One hidden JSON field rather than indexed inputs: a variant rule is a
	// nested object, and the column it lands in is jsonb anyway. A malformed
	// value must not wipe a working config, so fall back to leaving it alone.
	const filters = parseFilters(formData.get("filters"));

	const { error } = await supabase.from("searchparameters").insert({
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
		...(filters === undefined ? {} : { filters }),
	});

	if (error) {
		console.error("Inserting failed:", error);
	}
}
