"use server";

import { requireOwnerSession } from "@/lib/server/owner";
import { reviewCommandsEnabled } from "@/lib/server/reviewCommands";
import { saveGlobalFilters, type GlobalFiltersResult } from "@/lib/server/globalFilters";

/** Saves the global listing rules; the parser picks them up on its next revalidation. */
export async function saveGlobalRules(formData: FormData): Promise<{ error: string | null; result?: GlobalFiltersResult }> {
	try { await requireOwnerSession(); } catch { return { error: "Unauthorized" }; }
	if (!reviewCommandsEnabled()) return { error: "Команди вимкнені на сервері" };
	const version = Number(formData.get("version"));
	if (!Number.isSafeInteger(version) || version < 1) return { error: "Онови сторінку перед збереженням" };
	let filters: unknown;
	try { filters = JSON.parse(String(formData.get("filters") ?? "")); } catch { filters = null; }
	if (!filters || typeof filters !== "object" || Array.isArray(filters)) return { error: "Некоректні правила" };
	try {
		const commandId = String(formData.get("commandId") ?? "");
		if (!/^[0-9a-f-]{36}$/i.test(commandId)) return { error: "Некоректна команда" };
		return { error: null, result: await saveGlobalFilters(commandId, version, filters as Record<string, never>) };
	} catch (e) {
		console.error("Global rules save failed:", e instanceof Error ? e.message : e);
		return { error: "Не вдалося зберегти глобальні правила" };
	}
}
