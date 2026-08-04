import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/SupaBaseClient";

// Telegram webhook. The tracker on Fly only sends messages — acknowledging a
// super sniper alert lands here, and the tracker reads the flag when its timer
// fires. Must match ACK_CALLBACK_DATA in the tracker's telegram_notifier.py.
const ACK_DATA = "ack";
const DONE_DATA = "done";
const DONE_LABEL = "✅ Опрацьовано";

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
