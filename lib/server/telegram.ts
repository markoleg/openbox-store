import 'server-only';
import { renderKeyboard, urlButtons, type DeliveryView, type Menu, type ReplyMarkup } from '@/lib/reviewKeyboard';
import { deliveryView, enqueueKeyboardSync, mainDeliveriesForEvent, reviewDatabase } from '@/lib/server/reviewCommands';

const BOT_TOKEN = process.env.BOT_TOKEN;

/** The bot's numeric id is the first part of its token. */
export function botId(): number | null {
  const id = Number(BOT_TOKEN?.split(':')[0]);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export type TelegramResult = { ok: boolean; status: number; description: string };

export async function callTelegram(method: string, payload: unknown): Promise<TelegramResult> {
  if (!BOT_TOKEN) return { ok: false, status: 0, description: 'bot_disabled' };
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    let description = '';
    try { description = String((await res.json())?.description ?? ''); } catch { /* not JSON */ }
    if (!res.ok && !/not modified/.test(description)) {
      console.error(`Telegram ${method} failed (${res.status}):`, description);
    }
    return { ok: res.ok || /not modified/.test(description), status: res.status, description };
  } catch (e) {
    console.error(`Telegram ${method} error:`, e instanceof Error ? e.name : e);
    return { ok: false, status: 0, description: 'network' };
  }
}

/**
 * Stable command id for a callback retry: Telegram redelivers the same
 * callback_query.id, so the receipt makes the retry the same fact.
 */
export async function commandIdForCallback(bot: number, callbackId: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256',
    new TextEncoder().encode(`telegram-callback:${bot}:${callbackId}`)));
  digest[6] = (digest[6] & 0x0f) | 0x40;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const hex = Array.from(digest.slice(0, 16), b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function storedUrls(deliveryId: string) {
  const {data} = await reviewDatabase().from('notification_deliveries').select('message_payload').eq('id', deliveryId).maybeSingle();
  return urlButtons((data?.message_payload as {reply_markup?: ReplyMarkup} | null)?.reply_markup);
}

/**
 * Re-render one main-chat message from the server projection. The decision is
 * already committed; a failed edit only queues a durable UI retry.
 */
export async function syncDeliveryKeyboard(deliveryId: string, menu: Menu = 'root',
  view?: DeliveryView | null): Promise<DeliveryView | null> {
  const current = view ?? await deliveryView(deliveryId);
  if (!current || current.channel !== 'main') return current ?? null;
  const markup = renderKeyboard(current, await storedUrls(deliveryId), menu);
  const edit = await callTelegram('editMessageReplyMarkup', {
    chat_id: current.chatId, message_id: current.messageId, reply_markup: markup,
  });
  if (!edit.ok && menu === 'root') await enqueueKeyboardSync(current, markup);
  return current;
}

/** After a dashboard command: the origin message and its compatible main-chat siblings. */
export async function syncEventKeyboards(eventId: string): Promise<void> {
  const deliveries = await mainDeliveriesForEvent(eventId);
  await Promise.all(deliveries.map(async delivery => {
    const view = await deliveryView(delivery.id);
    if (!view) return;
    const markup = renderKeyboard(view, urlButtons(delivery.message_payload?.reply_markup));
    const edit = await callTelegram('editMessageReplyMarkup', {
      chat_id: view.chatId, message_id: view.messageId, reply_markup: markup,
    });
    if (!edit.ok) await enqueueKeyboardSync(view, markup);
  }));
}
