import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/SupaBaseClient";

// Telegram webhook. The tracker on Fly only sends messages — acknowledging a
// super sniper alert lands here, and the tracker reads the flag when its timer
// fires. Must match ACK_CALLBACK_DATA in the tracker's telegram_notifier.py.
const ACK_DATA = "ack";
const DONE_DATA = "done";
const DONE_LABEL = "✅ Опрацьовано";

// ShopParser buttons. callback_data is capped at 64 bytes, so they carry the
// shop_seen row id — links run past 120 chars and product_id is not unique.
const SHOP_BAN = "sb:";
const SHOP_HIDE = "sh:";

// zhezhemon buttons: "zb:<searchId>:<itemId>" / "zh:<itemId>". The eBay listing
// id travels rather than the link — it stays short whatever eBay does to its URL
// format, and all 3.5k stored links map to a distinct one.
const ZHE_BAN = "zb:";
const ZHE_HIDE = "zh:";

// Hiding has two modes. Plain "zh:<itemId>" keeps the original one - the lot
// returns once it drops below the price it was hidden at. "zh:<itemId>:<days>"
// pauses it instead: the price stops mattering and it returns when the deadline
// passes. Mirrors PAUSE_CHOICES in the tracker's hiding.py.
const PAUSE_DAYS = [1, 3, 5, 7];

/** Resolve an eBay listing id back to the stored link. */
async function linkForItemId(itemId: string): Promise<string | null> {
	// Anchored on "/itm/" so a shorter id cannot match a longer one by suffix.
	const { data } = await supabase
		.from("scraped_links")
		.select("link")
		.like("link", `%/itm/${itemId}`)
		.maybeSingle();
	return data?.link ?? null;
}

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

async function callTelegram(method: string, payload: unknown) {
	try {
		const res = await fetch(
			`https://api.telegram.org/bot${BOT_TOKEN}/${method}`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			}
		);
		if (!res.ok) {
			console.error(`Telegram ${method} failed (${res.status}):`, await res.text());
		}
	} catch (e) {
		console.error(`Telegram ${method} error:`, e);
	}
}

type InlineButton = { text?: string; url?: string; callback_data?: string };
type ReplyMarkup = { inline_keyboard?: InlineButton[][] };

/**
 * The keyboard a message keeps once its action button has been pressed: the first
 * row collapses to the outcome plus whatever URL buttons it held, and every row
 * below survives as-is (that is where Balances lives).
 *
 * `extraRows` go directly beneath the action row, and `keepPressed` decides
 * which callback buttons survive alongside the outcome. Hiding a zhezhemon lot
 * uses both: the pause durations appear, and Ban stays reachable, because
 * banning is a decision about the search that is not settled by hiding one lot
 * - and after a 7 day pause the next notification about it is a week away.
 */
function keyboardAfterAction(
	markup: ReplyMarkup | undefined,
	label: string,
	options: { extraRows?: InlineButton[][]; keepPressed?: string } = {}
): InlineButton[][] {
	const rows = markup?.inline_keyboard ?? [];
	const actionRow = rows[0] ?? [];
	const kept = actionRow.filter(
		(b) =>
			b.url ||
			(options.keepPressed !== undefined &&
				b.callback_data !== undefined &&
				!b.callback_data.startsWith(options.keepPressed))
	);
	return [
		[{ text: label, callback_data: DONE_DATA }, ...kept],
		...(options.extraRows ?? []),
		...rows.slice(1),
	];
}

/** The row of pause durations offered right after a lot is hidden. */
function pauseRow(itemId: string): InlineButton[] {
	return PAUSE_DAYS.map((days) => ({
		text: `⏸️ ${days}д`,
		callback_data: `${ZHE_HIDE}${itemId}:${days}`,
	}));
}

/** Ban or hide a shop.app product by its shop_seen id. Returns the toast text. */
async function handleShopAction(data: string): Promise<string> {
	const isBan = data.startsWith(SHOP_BAN);
	const id = Number(data.slice(3));
	if (!Number.isInteger(id)) {
		return "Некоректна кнопка";
	}

	const { data: seen, error: seenErr } = await supabase
		.from("shop_seen")
		.select("link, last_price")
		.eq("id", id)
		.maybeSingle();

	if (seenErr || !seen) {
		console.error("shop_seen lookup failed for id", id, seenErr?.message);
		return "Товар не знайдено";
	}

	if (isBan) {
		const { error } = await supabase
			.from("shop_seen")
			.update({ banned: true })
			.eq("id", id);
		if (error) {
			console.error("Error banning shop item:", error.message);
			return "Не вдалося забанити";
		}
		// Drop it from the current snapshot so it leaves the dashboard now.
		await supabase.from("shop_products").delete().eq("link", seen.link);
		return "🚫 Забанено";
	}

	// Hide until it gets cheaper: threshold = current known price.
	let threshold: number | null = seen.last_price ?? null;
	if (threshold == null) {
		const { data: prod } = await supabase
			.from("shop_products")
			.select("price")
			.eq("link", seen.link)
			.maybeSingle();
		threshold = prod?.price ?? null;
	}

	const { error } = await supabase
		.from("shop_seen")
		.update({ hidden: true, hide_price_threshold: threshold })
		.eq("id", id);
	if (error) {
		console.error("Error hiding shop item:", error.message);
		return "Не вдалося сховати";
	}
	return "🙈 Сховано";
}

/** Ban or hide an eBay listing from its notification. Returns the toast text. */
async function handleZheAction(data: string): Promise<string> {
	const isBan = data.startsWith(ZHE_BAN);
	const parts = data.slice(3).split(":");
	const itemId = isBan ? parts[1] : parts[0];
	const searchId = isBan ? Number(parts[0]) : null;
	// Only values this webhook itself put on a button are honoured; anything
	// else falls back to a plain hide rather than pausing for an odd stretch.
	const pauseDays =
		!isBan && PAUSE_DAYS.includes(Number(parts[1])) ? Number(parts[1]) : null;
	if (!itemId || (isBan && !Number.isInteger(searchId))) {
		return "Некоректна кнопка";
	}

	const link = await linkForItemId(itemId);
	if (!link) {
		return "Товар не знайдено";
	}

	// Both actions take it out of the dashboard listing straight away.
	const { error: hideErr } = await supabase
		.from("items")
		.update({ hidden: true })
		.eq("link", link);
	if (hideErr) {
		console.error("Error hiding item:", hideErr.message);
		return isBan ? "Не вдалося забанити" : "Не вдалося сховати";
	}

	if (!isBan) {
		// hidden_until is always written, null included: pressing plain Hide after
		// a pause has to clear the old deadline, or the lot would keep the pause
		// it was meant to replace.
		const hiddenUntil = pauseDays
			? new Date(Date.now() + pauseDays * 24 * 60 * 60 * 1000).toISOString()
			: null;
		const { error } = await supabase
			.from("scraped_links")
			.update({ hidden: true, hidden_until: hiddenUntil })
			.eq("link", link);
		if (error) {
			console.error("Error hiding scraped_link:", error.message);
			return "Не вдалося сховати";
		}
		return pauseDays ? `⏸️ Пауза ${pauseDays}д` : "🙈 Сховано";
	}

	// Ban is per search: the link goes into that search's banned list, so the
	// tracker skips it on every later cycle.
	const { data: search, error: fetchErr } = await supabase
		.from("searchparameters")
		.select("banned")
		.eq("id", searchId)
		.maybeSingle();
	if (fetchErr || !search) {
		console.error("Error fetching search", searchId, fetchErr?.message);
		return "Пошук не знайдено";
	}

	const banned: string[] = Array.isArray(search.banned) ? search.banned : [];
	if (!banned.includes(link)) {
		banned.push(link);
	}
	const { error: updErr } = await supabase
		.from("searchparameters")
		.update({ banned })
		.eq("id", searchId);
	if (updErr) {
		console.error("Error updating banned list:", updErr.message);
		return "Не вдалося забанити";
	}
	return "🚫 Забанено";
}

export async function POST(req: NextRequest) {
	// Routes under /api/ skip the auth middleware, so this header is the only gate.
	if (
		!WEBHOOK_SECRET ||
		req.headers.get("x-telegram-bot-api-secret-token") !== WEBHOOK_SECRET
	) {
		return new NextResponse("Forbidden", { status: 403 });
	}

	let update;
	try {
		update = await req.json();
	} catch {
		return NextResponse.json({ ok: true });
	}

	const query = update?.callback_query;
	if (!query) {
		return NextResponse.json({ ok: true });
	}

	// Already handled — just clear the client's spinner.
	if (query.data === DONE_DATA) {
		await callTelegram("answerCallbackQuery", { callback_query_id: query.id });
		return NextResponse.json({ ok: true });
	}

	const isShop = query.data?.startsWith(SHOP_BAN) || query.data?.startsWith(SHOP_HIDE);
	const isZhe = query.data?.startsWith(ZHE_BAN) || query.data?.startsWith(ZHE_HIDE);
	if (isShop || isZhe) {
		const label = isShop
			? await handleShopAction(query.data)
			: await handleZheAction(query.data);

		// Hiding a zhezhemon lot leaves the message usable: the pause durations
		// appear below, and Ban stays put. Banning settles the matter, so it
		// keeps the original behaviour of collapsing the row.
		const isZheHide = !isShop && query.data.startsWith(ZHE_HIDE);
		const hiddenItemId = isZheHide ? query.data.slice(3).split(":")[0] : "";
		const keyboardOptions = isZheHide
			? { extraRows: [pauseRow(hiddenItemId)], keepPressed: ZHE_HIDE }
			: {};
		await callTelegram("answerCallbackQuery", {
			callback_query_id: query.id,
			text: label,
		});
		// Replace the buttons with what actually happened, so the message shows its
		// own state — previously there was no way to tell it had been acted on.
		// URL buttons are kept: Sniper still leads to the form where a target price
		// is set, and Balances still answers what could pay for it — neither is made
		// pointless by banning. Rows below the first are kept as their own rows, so
		// the Balances row does not get folded into the action row or dropped.
		if (query.message?.message_id) {
			await callTelegram("editMessageReplyMarkup", {
				chat_id: query.message.chat?.id,
				message_id: query.message.message_id,
				reply_markup: {
					inline_keyboard: keyboardAfterAction(
						query.message.reply_markup,
						label,
						keyboardOptions
					),
				},
			});
		}
		return NextResponse.json({ ok: true });
	}

	if (query.data !== ACK_DATA) {
		await callTelegram("answerCallbackQuery", { callback_query_id: query.id });
		return NextResponse.json({ ok: true });
	}

	const { data: window, error } = await supabase
		.from("sniper_ack")
		.update({ acked_at: new Date().toISOString() })
		.eq("id", 1)
		.select("pending_chat_id, pending_message_ids")
		.single();

	if (error) {
		console.error("Error recording sniper ack:", error);
	}

	await callTelegram("answerCallbackQuery", {
		callback_query_id: query.id,
		text: "Дзвінка не буде",
	});

	// One press covers the whole window — mark every message of it, otherwise the
	// others keep a live button and it is unclear whether they need pressing too.
	const chatId = window?.pending_chat_id ?? query.message?.chat?.id;
	const messageIds: number[] = window?.pending_message_ids?.length
		? window.pending_message_ids
		: query.message?.message_id
		? [query.message.message_id]
		: [];

	// Only the pressed message comes with its keyboard, so only it can keep the rows
	// below the acknowledge button (Balances, whose link is per-message). The rest of
	// the window is marked done and loses theirs — the alert is being handled anyway.
	for (const messageId of messageIds) {
		const isPressedMessage = messageId === query.message?.message_id;
		await callTelegram("editMessageReplyMarkup", {
			chat_id: chatId,
			message_id: messageId,
			reply_markup: {
				inline_keyboard: isPressedMessage
					? keyboardAfterAction(query.message?.reply_markup, DONE_LABEL)
					: [[{ text: DONE_LABEL, callback_data: DONE_DATA }]],
			},
		});
	}

	return NextResponse.json({ ok: true });
}
