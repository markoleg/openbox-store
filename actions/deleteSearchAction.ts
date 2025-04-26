"use server";

import { supabase } from "@/lib/SupaBaseClient";

export async function deleteSearch(searchId: number) {
	const { error } = await supabase
		.from("searchparameters")
		.delete()
		.eq("id", searchId);

	if (error) {
		console.error("Error deleting search:", error);
	} else {
		console.log("Search deleted successfully", searchId);
	}
}
