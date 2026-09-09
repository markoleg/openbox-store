"use server";

import { supabase } from "@/lib/SupaBaseClient";

export async function deleteSearch(searchId: number) {
	const graceSeconds = Number(
		process.env.ITEM_PRESENCE_GRACE_SECONDS ?? "300"
	);
	if (!Number.isInteger(graceSeconds) || graceSeconds <= 0) {
		return { error: "Invalid ITEM_PRESENCE_GRACE_SECONDS" };
	}

	const { data: deleted, error } = await supabase.rpc(
		"delete_search_with_owner_transfer",
		{
			p_search_id: searchId,
			p_presence_grace_seconds: graceSeconds,
		}
	);

	if (error) {
		console.error("Error deleting search:", error);
		return { error: error.message };
	}
	if (!deleted) {
		return { error: "Search not found" };
	}

	console.log("Search deleted successfully", searchId);
	return { error: null };
}
