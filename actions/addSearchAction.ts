"use server";

import { requireOwnerSession } from "@/lib/server/owner";
import { createSearchConfiguration, reviewCommandsEnabled } from "@/lib/server/reviewCommands";
import { bannedLinksFromForm, searchConfigFromForm } from "@/lib/searchConfig";

/** Creates a search through the audited RPC; the browser key can no longer insert. */
export async function addSearch(formData: FormData): Promise<{ error: string | null; searchId?: number }> {
	try { await requireOwnerSession(); } catch { return { error: "Unauthorized" }; }
	if (!reviewCommandsEnabled()) return { error: "Команди вимкнені на сервері" };
	const banned = bannedLinksFromForm(formData);
	if (!banned.every(link => /^https:\/\//.test(link) && link.length <= 500)) return { error: "Некоректне посилання в Banned Links" };
	try {
		const result = await createSearchConfiguration(crypto.randomUUID(), searchConfigFromForm(formData), banned);
		return { error: null, searchId: result?.searchId };
	} catch (e) {
		console.error("Inserting failed:", e instanceof Error ? e.message : e);
		return { error: "Не вдалося створити пошук" };
	}
}
