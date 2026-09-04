import { supabase } from "@/lib/SupaBaseClient";

/** Pause lengths offered in the UI. Mirrors PAUSE_CHOICES in the tracker. */
export const PAUSE_DAYS = [1, 3, 5, 7];

/**
 * Hiding lives in two tables and both have to move together.
 *
 * `items` is what the dashboard lists, and `scraped_links` is what the tracker
 * reads before deciding whether to notify. Writing only the first - which the
 * toast used to do - hides a lot from the page while Telegram keeps announcing
 * it, and the next price change puts it back on the page anyway.
 *
 * `hidden_until` decides which of the two modes a lot is in, so it is written
 * on every call, null included. Otherwise a hide would inherit the deadline of
 * a pause set earlier and come back on a date nobody remembers choosing.
 */
async function writeHidden(
	link: string,
	hidden: boolean,
	hiddenUntil: string | null
) {
	const [links, items] = await Promise.all([
		supabase
			.from("scraped_links")
			.update({ hidden, hidden_until: hiddenUntil })
			.eq("link", link),
		supabase.from("items").update({ hidden }).eq("link", link),
	]);
	if (links.error) console.error("Error updating scraped_links:", links.error.message);
	if (items.error) console.error("Error updating items:", items.error.message);
}

/** Hide until it drops below what it costs now. */
export function hideUntilCheaper(link: string) {
	return writeHidden(link, true, null);
}

/** Set aside for a fixed stretch; the price stops mattering until it ends. */
export function pauseFor(link: string, days: number) {
	const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
	return writeHidden(link, true, until);
}

export function unhide(link: string) {
	return writeHidden(link, false, null);
}

/** "до 11.09" or "до подешевшання" - which mode a hidden lot is in. */
export function describeHide(hiddenUntil?: string | null): string {
	if (!hiddenUntil) return "до подешевшання";
	const date = new Date(hiddenUntil);
	if (Number.isNaN(date.getTime())) return "до подешевшання";
	return `до ${date.toLocaleDateString("uk-UA", { day: "2-digit", month: "2-digit" })}`;
}
