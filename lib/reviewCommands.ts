/** Shared wire contract. Pure validation, no secrets or database access. */
export const reviewActions = ['review_ack', 'hide', 'pause', 'extend_pause', 'unhide',
  'ban', 'unban', 'set_like', 'set_outcome', 'clear_outcome'] as const;
export type ReviewAction = typeof reviewActions[number];
export type ReviewContextKind = 'listing' | 'event' | 'delivery';
export type ReviewCommand = {
  commandId: string; contextId: string; action: ReviewAction;
  payload: { days?: number; value?: boolean | string; note?: string; reason?: string };
};
export type ReviewCommandResult = {
  status: 'applied' | 'noop' | 'conflict' | 'rejected';
  reactionId?: string | null; reason?: string; listingVersion?: number;
  currentPrice?: number; contextPrice?: number; contextId?: string;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function exactKeys(value: Record<string, unknown>, allowed: string[]) {
  return Object.keys(value).every(key => allowed.includes(key));
}
export function parseReviewContext(value: unknown): {kind: ReviewContextKind; target: string} {
  if (!record(value) || !exactKeys(value, ['kind', 'target']) ||
      !['listing','event','delivery'].includes(String(value.kind)) || typeof value.target !== 'string') {
    throw new Error('invalid_context');
  }
  if (value.kind === 'listing') {
    // Only an already registered canonical eBay link is accepted by the RPC.
    const url = new URL(value.target);
    if (url.protocol !== 'https:' || !/(^|\.)ebay\.(com|co\.uk|de|ca|com\.au)$/.test(url.hostname)
        || url.username || url.password || url.search || url.hash || !/\/itm\/[0-9]+$/.test(url.pathname)) {
      throw new Error('invalid_listing_link');
    }
  } else if (!uuid.test(value.target)) throw new Error('invalid_context_id');
  return value as {kind: ReviewContextKind; target: string};
}
export function parseReviewCommand(value: unknown): ReviewCommand {
  if (!record(value) || !exactKeys(value, ['commandId','contextId','action','payload']) ||
      typeof value.commandId !== 'string' || !uuid.test(value.commandId) ||
      typeof value.contextId !== 'string' || !uuid.test(value.contextId) ||
      !reviewActions.includes(value.action as ReviewAction) || !record(value.payload)) {
    throw new Error('invalid_command');
  }
  const p = value.payload;
  if (!exactKeys(p, ['days','value','note','reason']) ||
      (p.note !== undefined && (typeof p.note !== 'string' || p.note.length > 4000)) ||
      (p.reason !== undefined && (typeof p.reason !== 'string' || p.reason.length > 1000))) {
    throw new Error('invalid_payload');
  }
  const action = value.action;
  if (['pause','extend_pause'].includes(String(action))) {
    if (typeof p.days !== 'number' || ![1,3,5,7].includes(p.days)) throw new Error('invalid_pause_days');
  } else if (p.days !== undefined) throw new Error('unexpected_days');
  if (action === 'set_like') {
    if (typeof p.value !== 'boolean') throw new Error('invalid_like');
  } else if (action === 'set_outcome') {
    if (!['bought','would_buy_missed','would_hide','bug'].includes(String(p.value))) throw new Error('invalid_outcome');
  } else if (p.value !== undefined) throw new Error('unexpected_value');
  if (['clear_outcome','extend_pause'].includes(String(action)) &&
      (typeof p.reason !== 'string' || !p.reason.trim())) throw new Error('reason_required');
  return value as ReviewCommand;
}
