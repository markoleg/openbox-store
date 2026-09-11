"use server";

import { requireOwnerSession } from "@/lib/server/owner";
import { deleteSearchConfiguration, reviewCommandsEnabled } from "@/lib/server/reviewCommands";
import { isUuid } from "@/lib/reviewCommands";

/**
 * Deletes a search through the audited RPC (owner transfer inside). The
 * commandId comes from the click so a retry is the same deletion.
 */
export async function deleteSearch(searchId: number, commandId: string): Promise<{ error: string | null }> {
	try { await requireOwnerSession(); } catch { return { error: "Unauthorized" }; }
	if (!reviewCommandsEnabled()) return { error: "Команди вимкнені на сервері" };
	if (!Number.isInteger(searchId) || searchId <= 0 || !isUuid(commandId)) return { error: "Invalid request" };
	const graceSeconds = Number(process.env.ITEM_PRESENCE_GRACE_SECONDS ?? "300");
	if (!Number.isInteger(graceSeconds) || graceSeconds <= 0) {
		return { error: "Invalid ITEM_PRESENCE_GRACE_SECONDS" };
	}
	try {
		const result = await deleteSearchConfiguration(commandId, searchId, graceSeconds);
		if (result?.status === "rejected") return { error: "Search not found" };
		return { error: null };
	} catch (e) {
		console.error("Error deleting search:", e instanceof Error ? e.message : e);
		return { error: "Не вдалося видалити пошук" };
	}
}
