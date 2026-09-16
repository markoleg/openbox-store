import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { ReviewCommand, ReviewCommandResult, ReviewContext, ReviewContextRequest, SearchSaveRequest }
  from '@/lib/reviewCommands';
import { dispatchIdFromToken } from '@/lib/reviewCommands';
import type { DeliveryView, ReplyMarkup } from '@/lib/reviewKeyboard';

export function reviewDatabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!key || !url) throw new Error('review_server_not_configured');
  return createClient(url, key, {auth: {persistSession: false, autoRefreshToken: false}});
}

export function reviewCommandsEnabled(): boolean {
  return process.env.REVIEW_COMMANDS_ENABLED === 'true';
}

async function rpc(name: string, args: Record<string, unknown>) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const {data, error} = await reviewDatabase().rpc(name, args);
    if (!error) return data;
    if (['40P01','40001'].includes(error.code) && attempt < 2) {
      await new Promise(resolve => setTimeout(resolve, 30 * (attempt + 1)));
      continue;
    }
    // Do not expose SQL details or raw listing data to the HTTP error response.
    throw new Error(['22023','22P02','P0002','23514'].includes(error.code) ? 'invalid_review_request' : 'review_storage_failed');
  }
  throw new Error('review_storage_failed');
}

// Internal server primitives; callers MUST authenticate before using these.
// They never fetch eBay, infer a delivery by link, or accept an actor/time from the client.
export async function issueReviewContext(request: ReviewContextRequest): Promise<ReviewContext> {
  if (request.kind === 'dispatch') {
    const resolved = await resolveDispatch(request.target);
    if (!resolved) throw new Error('invalid_review_request');
    return rpc('issue_review_context', {p_kind: resolved.kind, p_target: resolved.target});
  }
  return rpc('issue_review_context', {p_kind: request.kind, p_target: request.target,
    p_search_id: request.searchId ?? null, p_register: request.register ?? false});
}

/**
 * A Telegram URL button only knows its dispatch. Prefer the confirmed delivery
 * (the message the buyer is looking at); a dispatch without one still has a
 * causal event, which is an honest context without a Telegram SLA.
 */
export async function resolveDispatch(token: string): Promise<{kind: 'delivery' | 'event'; target: string} | null> {
  const id = dispatchIdFromToken(token);
  if (!id) return null;
  const db = reviewDatabase();
  const {data: delivery} = await db.from('notification_deliveries').select('id')
    .eq('dispatch_id', id).order('telegram_sent_at', {ascending: true}).limit(1).maybeSingle();
  if (delivery?.id) return {kind: 'delivery', target: delivery.id};
  const {data: dispatch} = await db.from('notification_dispatches').select('event_id').eq('id', id).maybeSingle();
  return dispatch?.event_id ? {kind: 'event', target: dispatch.event_id} : null;
}

export async function applyReviewCommand(command: ReviewCommand,
  source: 'dashboard' | 'dashboard_toast' | 'telegram' | 'legacy_telegram' = command.source ?? 'dashboard'): Promise<ReviewCommandResult> {
  return rpc('apply_review_command', {p_command: command.commandId, p_context: command.contextId,
    p_action: command.action, p_payload: command.payload, p_source: source});
}

export async function saveSearchConfiguration(request: SearchSaveRequest) {
  return rpc('save_search_configuration', {p_command: request.commandId, p_search_id: request.searchId,
    p_expected_version: request.expectedVersion, p_config: request.config, p_ban: request.ban, p_unban: request.unban});
}
export async function createSearchConfiguration(commandId: string, config: Record<string, unknown>, banned: string[]) {
  return rpc('create_search_configuration', {p_command: commandId, p_config: config, p_banned: banned});
}
export async function deleteSearchConfiguration(commandId: string, searchId: number, graceSeconds: number) {
  return rpc('delete_search_configuration', {p_command: commandId, p_search_id: searchId,
    p_presence_grace_seconds: graceSeconds});
}

export async function deliveryView(deliveryId: string): Promise<DeliveryView | null> {
  return (await rpc('review_delivery_view', {p_delivery: deliveryId})) ?? null;
}

export async function eventLink(eventId: string): Promise<string | null> {
  const {data} = await reviewDatabase().from('notification_events').select('link').eq('id', eventId).maybeSingle();
  return data?.link ?? null;
}

/** The delivery a pressed Telegram message corresponds to, if it is recorded. */
export async function deliveryForMessage(botId: number, chatId: number, messageId: number) {
  const {data} = await reviewDatabase().from('notification_deliveries')
    .select('id, dispatch_id, event_id, channel, state_version, message_payload')
    .eq('bot_id', botId).eq('chat_id', chatId).eq('message_id', messageId).maybeSingle();
  return data ?? null;
}

export async function reconcileUnknownDelivery(dispatchId: string, botId: number, chatId: number,
  messageId: number, sentAt: Date): Promise<{status: string; reason?: string; deliveryId?: string}> {
  return rpc('reconcile_unknown_delivery', {p_dispatch: dispatchId, p_bot: botId, p_chat: chatId,
    p_message: messageId, p_sent_at: sentAt.toISOString()});
}

/** Main-chat deliveries of one event with their stored keyboards, for sibling sync. */
export async function mainDeliveriesForEvent(eventId: string): Promise<{id: string; message_payload: {reply_markup?: ReplyMarkup}}[]> {
  const {data} = await reviewDatabase().from('notification_deliveries').select('id, message_payload')
    .eq('event_id', eventId).eq('channel', 'main');
  return (data ?? []) as {id: string; message_payload: {reply_markup?: ReplyMarkup}}[];
}

/** History page data: reactions and deliveries of a link, newest first, no raw payloads. */
export async function listingHistory(link: string) {
  const db = reviewDatabase();
  const [reactions, deliveries, review, state, live, events] = await Promise.all([
    db.from('listing_reactions').select('id, action, outcome, reason_code, note, source, received_at, delivery_id, event_id, supersedes_reaction_id')
      .eq('link', link).order('received_at', {ascending: false}).limit(200),
    db.from('notification_deliveries').select('id, event_id, channel, chat_id, message_id, telegram_sent_at, resolution_kind, first_reaction_id, resolved_by_reaction_id')
      .eq('link', link).order('telegram_sent_at', {ascending: false}).limit(100),
    db.from('listing_reviews').select('id, submitted_at, revision_opened_at, origin_delivery_id, version').eq('link', link).maybeSingle(),
    db.from('listing_review_state').select('liked, registration_source, observed_total, latest_seen_at, latest_summary, state_version').eq('link', link).maybeSingle(),
    db.from('scraped_links').select('hidden, hidden_until, price, favorite, super_favorite, desired_price, description, count').eq('link', link).maybeSingle(),
    db.from('notification_events').select('id, kind, detected_at, source_search_id, preflight_status, suppression_reason, search_snapshot')
      .eq('link', link).order('detected_at', {ascending: false}).limit(50),
  ]);
  if ([reactions,deliveries,review,state,live,events].some(result=>result.error)) throw new Error('review_storage_failed');
  return {reactions: reactions.data ?? [], deliveries: deliveries.data ?? [], review: review.data ?? null,
    state: state.data ?? null, live: live.data ?? null, events: events.data ?? []};
}

/** A durable retry for a keyboard edit that failed after the command committed. */
export async function enqueueKeyboardSync(view: DeliveryView, replyMarkup: ReplyMarkup) {
  const {error} = await reviewDatabase().from('review_jobs').upsert({
    kind: 'telegram_ui_sync', dedup_key: `ui:${view.deliveryId}`, state: 'pending',
    next_run_at: new Date().toISOString(), lease_until: null, worker_token: null, attempts: 0, last_error: null,
    payload: {delivery_id: view.deliveryId, state_version: view.stateVersion, chat_id: view.chatId,
      message_id: view.messageId, reply_markup: replyMarkup},
  }, {onConflict: 'dedup_key'});
  if (error) console.error('Keyboard sync job not stored:', error.code);
}
