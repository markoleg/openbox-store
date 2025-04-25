"use server";
import { supabase } from "@/lib/SupaBaseClient";

export async function updateSearch(formData: FormData) {
	const id = Number(formData.get("id"));
	const keywords = formData.get("keywords");
	const model = formData.get("model");
	const minprice = Number(formData.get("minprice"));
	const maxprice = Number(formData.get("maxprice"));
	const brand = formData.get("brand");
	const seller = formData.get("seller");

	const { error } = await supabase
		.from("searchparameters")
		.update({ keywords, model, minprice, maxprice, brand, seller })
		.eq("id", id);

	if (error) {
		console.error("Update failed:", error);
	}
}
