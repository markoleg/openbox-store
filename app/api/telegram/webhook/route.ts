import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/SupaBaseClient";
import { PAUSE_DAYS, type ReviewAction, type ReviewPayload } from "@/lib/reviewCommands";
import { describeResult, parseReviewCallback, type Menu, type ReviewCallback } from "@/lib/reviewKeyboard";
import {
	applyReviewCommand, deliveryForMessage, deliveryView, issueReviewContext, reconcileUnknownDelivery,
	reviewCommandsEnabled,
} from "@/lib/server/reviewCommands";
import { botId, callTelegram, commandIdForCallback, syncDeliveryKeyboard, syncEventKeyboards } from "@/lib/server/telegram";

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

// Legacy zhezhemon buttons (messages sent before the review pipeline):
// "zb:<searchId>:<itemId>" / "zh:<itemId>[:<days>]". They still work, but as
// journaled commands with source=legacy_telegram and no delivery: the message
// they sit on was never recorded, so nothing is guessed about it.
const ZHE_BAN = "zb:";
const ZHE_HIDE = "zh:";

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

const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

/** Only the configured buyer may issue procurement commands. Fails closed. */
function allowedUser(userId: unknown): boolean {
	const users = (process.env.TELEGRAM_ALLOWED_USER_IDS ?? "").split(",").map(s => s.trim()).filter(Boolean);
	return users.length > 0 && users.includes(String(userId));
}

type InlineButton = { text?: string; url?: string; callback_data?: string };
type ReplyMarkup = { inline_keyboard?: InlineButton[][] };

/**
 * The keyboard a legacy message keeps once its action button has been pressed:
 * the first row collapses to the outcome plus whatever URL buttons it held,
 * and every row below survives as-is (that is where Balances lives).
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
				b.callback_data !== DONE_DATA &&
				!b.callback_data.startsWith(options.keepPressed))
	);
	const rest = rows.slice(1).filter((row) => !isPauseRow(row));
	return [
		[{ text: label, callback_data: DONE_DATA }, ...kept],
		...(options.extraRows ?? []),
		...rest,
	];
}

/** Whether a row is one this function built: every button a pause duration. */
function isPauseRow(row: InlineButton[]): boolean {
	return (
		row.length > 0 &&
		row.every(
			(b) =>
				b.callback_data !== undefined &&
				b.callback_data.startsWith(ZHE_HIDE) &&
				b.callback_data.split(":").length === 3
		)
	);
}

/** The row of pause durations offered right after a legacy lot is hidden. */
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

/**
 * Legacy Ban/Hide from a message sent before the review pipeline. Applied as an
 * explicit command on the listing (source=legacy_telegram, delivery NULL).
 * Returns the toast text; errors are never reported as success.
 */
async function handleLegacyZheAction(data: string, commandId: string): Promise<string> {
	const isBan = data.startsWith(ZHE_BAN);
	const parts = data.slice(3).split(":");
	const itemId = isBan ? parts[1] : parts[0];
	const searchId = isBan ? Number(parts[0]) : null;
	const pauseDays = !isBan && (PAUSE_DAYS as readonly number[]).includes(Number(parts[1])) ? Number(parts[1]) : null;
	if (!itemId || !/^[0-9]+$/.test(itemId) || (isBan && !Number.isInteger(searchId))) {
		return "Некоректна кнопка";
	}
	if (!reviewCommandsEnabled()) return "Команди вимкнені";
	const link = await linkForItemId(itemId);
	if (!link) return "Товар не знайдено";
	try {
		const context = await issueReviewContext({ kind: "listing", target: link, ...(isBan ? { searchId: searchId! } : {}) });
		const action: ReviewAction = isBan ? "ban" : pauseDays ? "pause" : "hide";
		const payload: ReviewPayload = pauseDays ? { days: pauseDays } : {};
		const result = await applyReviewCommand({ commandId, contextId: context.id, action, payload }, "legacy_telegram");
		if (result.status === "applied" || result.status === "noop") {
			return isBan ? "🚫 Забанено" : pauseDays ? `⏸️ Пауза ${pauseDays}д` : "🙈 Сховано";
		}
		if (result.reason === "price_changed") return `Ціна змінилась ($${result.contextPrice} → $${result.currentPrice}) — сховай з дашборда`;
		if (result.reason === "search_changed_or_deleted") return "Пошук змінено або видалено";
		if (result.reason === "price_unknown") return "Ціна невідома — сховай з дашборда";
		return "Не виконано: стан уже змінено";
	} catch (error) {
		const invalid = error instanceof Error && error.message === "invalid_review_request";
		return isBan ? (invalid ? "Пошук не знайдено" : "Не вдалося забанити") : "Не вдалося сховати";
	}
}

const outcomeCodes: Record<string, string> = { bought: "bought", would_hide: "would_hide" };

/** Which command a review button stands for; menu buttons return null. */
function commandFor(cb: ReviewCallback): { action: ReviewAction; payload: ReviewPayload } | null {
	switch (cb.code) {
		case "ack": return { action: "review_ack", payload: {} };
		case "bought": return { action: "set_outcome", payload: { value: "bought" } };
		case "hide": return { action: "hide", payload: {} };
		case "ban": return { action: "ban", payload: {} };
		case "unhide": return { action: "unhide", payload: {} };
		case "unban": return { action: "unban", payload: {} };
		case "whide": return { action: "set_outcome", payload: { value: "would_hide" } };
		case "pause": {
			const days = Number(cb.arg);
			return (PAUSE_DAYS as readonly number[]).includes(days) ? { action: "pause", payload: { days } } : null;
		}
		case "missed":
			return ["sold_out", "price_changed", "limit_or_funds", "other"].includes(cb.arg ?? "")
				? { action: "set_outcome", payload: { value: "would_buy_missed", reason: cb.arg! } } : null;
		case "chg":
			return outcomeCodes[cb.arg ?? ""] ? { action: "set_outcome", payload: { value: outcomeCodes[cb.arg!] } } : null;
		default: return null;
	}
}
const menuFor: Partial<Record<ReviewCallback["code"], Menu>> = { pausem: "pause", missedm: "missed", more: "more", chgm: "change", back: "root", noop: "root" };

type CallbackQuery = {
	id: string; data?: string; from?: { id?: number };
	message?: { message_id?: number; date?: number; chat?: { id?: number }; reply_markup?: ReplyMarkup };
};

/**
 * A review-pipeline button. Order: secret (done by caller) → buyer allowlist →
 * the pressed message must be the delivery of the dispatch on the button
 * (an unknown send is reconciled by this proof) → dedup by callback id →
 * context/version checks inside the RPC → keyboard re-rendered from the
 * committed projection. Menus change nothing.
 */
async function handleReviewCallback(query: CallbackQuery, cb: ReviewCallback): Promise<void> {
	const answer = (text?: string, alert = false) =>
		callTelegram("answerCallbackQuery", { callback_query_id: query.id, ...(text ? { text, show_alert: alert } : {}) });
	const bot = botId();
	const chat = Number(query.message?.chat?.id);
	const messageId = Number(query.message?.message_id);
	if (!bot || !Number.isSafeInteger(chat) || !Number.isSafeInteger(messageId)) { await answer("Некоректна кнопка"); return; }
	if (!allowedUser(query.from?.id)) { await answer("Немає доступу", true); return; }
	if (!reviewCommandsEnabled()) { await answer("Команди вимкнені", true); return; }

	let delivery = await deliveryForMessage(bot, chat, messageId);
	if (!delivery) {
		// The message exists (it was just pressed). If its send was unknown, this
		// is the proof that reconciles it — for this dispatch in this chat only.
		const sentAt = new Date((Number(query.message?.date) || Math.floor(Date.now() / 1000)) * 1000);
		const reconciled = await reconcileUnknownDelivery(cb.dispatchId, bot, chat, messageId, sentAt).catch(() => null);
		if (reconciled?.deliveryId) delivery = await deliveryForMessage(bot, chat, messageId);
		if (!delivery) { await answer("Повідомлення не в журналі — відкрий картку з дашборда", true); return; }
	}
	if (delivery.dispatch_id !== cb.dispatchId) { await answer("Кнопка не від цього повідомлення", true); return; }

	const menu = menuFor[cb.code];
	if (menu) {
		await answer();
		await syncDeliveryKeyboard(delivery.id, menu);
		return;
	}
	const command = commandFor(cb);
	if (!command) { await answer("Некоректна кнопка"); return; }
	try {
		const context = await issueReviewContext({ kind: "delivery", target: delivery.id });
		const result = await applyReviewCommand({
			commandId: await commandIdForCallback(bot, query.id), contextId: context.id,
			action: command.action, payload: command.payload,
		}, "telegram");
		const view = await deliveryView(delivery.id);
		await answer(describeResult(command.action, result, view), result.status === "conflict" || result.status === "rejected");
		// Commit is the source of truth; the message and its main-chat siblings
		// follow it. A failed edit becomes a durable review_jobs retry.
		await syncEventKeyboards(delivery.event_id);
	} catch (error) {
		console.error("Review callback failed:", error instanceof Error ? error.message : error);
		await answer("Не вдалося виконати — спробуй ще раз або з дашборда", true);
	}
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

	const query: CallbackQuery | undefined = update?.callback_query;
	if (!query) {
		return NextResponse.json({ ok: true });
	}

	// Already handled — just clear the client's spinner.
	if (query.data === DONE_DATA) {
		await callTelegram("answerCallbackQuery", { callback_query_id: query.id });
		return NextResponse.json({ ok: true });
	}

	const review = parseReviewCallback(query.data);
	if (review) {
		await handleReviewCallback(query, review);
		return NextResponse.json({ ok: true });
	}

	const isShop = query.data?.startsWith(SHOP_BAN) || query.data?.startsWith(SHOP_HIDE);
	const isZhe = query.data?.startsWith(ZHE_BAN) || query.data?.startsWith(ZHE_HIDE);
	if (isShop || isZhe) {
		let label: string;
		if (isShop) {
			label = await handleShopAction(query.data!);
		} else if (!allowedUser(query.from?.id)) {
			label = "Немає доступу";
		} else {
			const bot = botId();
			label = bot ? await handleLegacyZheAction(query.data!, await commandIdForCallback(bot, query.id)) : "Бот не налаштований";
		}
		const succeeded = /^(🚫|🙈|⏸️)/.test(label);

		// Hiding a legacy zhezhemon lot leaves the message usable: the pause
		// durations appear below, and Ban stays put. Banning settles the matter.
		const isZheHide = !isShop && query.data!.startsWith(ZHE_HIDE);
		const hiddenItemId = isZheHide ? query.data!.slice(3).split(":")[0] : "";
		const keyboardOptions = isZheHide
			? { extraRows: [pauseRow(hiddenItemId)], keepPressed: ZHE_HIDE }
			: {};
		await callTelegram("answerCallbackQuery", {
			callback_query_id: query.id,
			text: label,
			show_alert: !succeeded,
		});
		// Only what actually happened is written onto the message: a failure
		// leaves the buttons as they were, so it can be pressed again.
		if (succeeded && query.message?.message_id) {
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

	// Legacy super-sniper ACK: unchanged mechanism (call window), not a review
	// reaction. It stays on the browser key's table and never touches the journal.
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
