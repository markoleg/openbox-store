"use server";
import { supabase } from "@/lib/SupaBaseClient";

const addNewSniperItem = async (item: FormData) => {
	const link = item.get("link")?.toString().trim();
	const desiredPrice = parseFloat(
		item.get("desired_price")?.toString().trim() || "0"
	);
	try {
		const { data: existingItem, error: fetchError } = await supabase
			.from("scraped_links")
			.select("*")
			.eq("link", link)
			.single();

		if (fetchError && fetchError.code !== "PGRST116") {
			// PGRST116 is Supabase's code for "No rows found"
			console.error("Error checking existing item:", fetchError);
			return;
		}

		const isExisting = !!existingItem;
		const payload = {
			link: link,
			desired_price: desiredPrice,
			favorite: true,
			count: 1,
		};

		const { error: dbError } = isExisting
			? await supabase
					.from("scraped_links")
					.update({ favorite: true, desired_price: desiredPrice })
					.eq("link", link)
			: await supabase.from("scraped_links").insert(payload);

		if (dbError) {
			console.error("Error saving item:", dbError);
		} else {
			console.log(
				isExisting ? "Item updated successfully" : "Item inserted successfully"
			);
		}
	} catch (err) {
		console.error("Unexpected error while adding item:", err);
	}
};

export { addNewSniperItem };
