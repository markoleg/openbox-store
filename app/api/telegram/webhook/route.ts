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
		const { error } = await supabase
			.from("scraped_links")
			.update({ hidden: true })
			.eq("link", link);
		if (error) {
			console.error("Error hiding scraped_link:", error.message);
			return "Не вдалося сховати";
		}
		return "🙈 Сховано";
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
		await callTelegram("answerCallbackQuery", {
			callback_query_id: query.id,
			text: label,
		});
		// Replace the buttons with what actually happened, so the message shows its
		// own state — previously there was no way to tell it had been acted on.
		// The zhezhemon Sniper button is a URL and is kept: it still leads to the
		// form where a target price is set, which banning does not make pointless.
		if (query.message?.message_id) {
			const kept = (query.message.reply_markup?.inline_keyboard?.[0] ?? []).filter(
				(b: { url?: string }) => b.url
			);
			await callTelegram("editMessageReplyMarkup", {
				chat_id: query.message.chat?.id,
				message_id: query.message.message_id,
				reply_markup: {
					inline_keyboard: [[{ text: label, callback_data: DONE_DATA }, ...kept]],
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

	for (const messageId of messageIds) {
		await callTelegram("editMessageReplyMarkup", {
			chat_id: chatId,
			message_id: messageId,
			reply_markup: {
				inline_keyboard: [[{ text: DONE_LABEL, callback_data: DONE_DATA }]],
			},
		});
	}

	return NextResponse.json({ ok: true });
}
