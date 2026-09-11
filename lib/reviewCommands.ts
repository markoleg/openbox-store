/** Shared wire contract. Pure validation, no secrets or database access. */
export const reviewActions = ['review_ack', 'hide', 'pause', 'extend_pause', 'unhide',
  'ban', 'unban', 'set_like', 'set_outcome', 'clear_outcome', 'set_watch', 'remove_watch'] as const;
export type ReviewAction = typeof reviewActions[number];
export type ReviewContextKind = 'listing' | 'event' | 'delivery' | 'dispatch';
export type ReviewSource = 'dashboard' | 'dashboard_toast';
export const manualOutcomes = ['bought', 'would_buy_missed', 'would_hide', 'bug'] as const;
export type ManualOutcome = typeof manualOutcomes[number];
export const missedReasons = ['sold_out', 'price_changed', 'limit_or_funds', 'other'] as const;
export const bugTypes = ['selection_error', 'technical_duplicate', 'already_unavailable', 'other'] as const;
export const PAUSE_DAYS = [1, 3, 5, 7] as const;

export type WatchPayload = {
  favorite: true; super_favorite?: boolean; desired_price: number | null; description?: string | null;
};
export type ReviewPayload = {
  days?: number; value?: boolean | string; note?: string; reason?: string;
} | WatchPayload;
export type ReviewCommand = {
  commandId: string; contextId: string; action: ReviewAction; payload: ReviewPayload; source?: ReviewSource;
};
/**
 * A context request. `searchId` scopes a listing-context ban/unban to an
 * explicit search (form, legacy callbacks); `register` lets Sniper add a link
 * the tracker has never seen; `dispatch` is what the Telegram buttons carry.
 */
export type ReviewContextRequest = {
  kind: ReviewContextKind; target: string; searchId?: number; register?: boolean;
};
export type LiveState = {
  hidden: boolean | null; hidden_until: string | null; favorite: boolean | null;
  super_favorite: boolean | null; desired_price: number | null; description: string | null;
  liked?: boolean | null; banned_in_search?: boolean | null;
};
export type ReviewContext = {
  id: string; kind: Exclude<ReviewContextKind, 'dispatch'>; link: string; event_id: string | null;
  delivery_id: string | null; search_id: number | null; snapshot_id: string;
  listing_version: number; result_version: number; search_version: number | null; registered?: boolean;
  snapshot: { id: string; observed_at: string; source: string; data: Record<string, unknown> };
  search: Record<string, unknown> | null;
  live: { listing_version: number; liked: boolean; stock_blocked: boolean; search_version: number | null;
    state: LiveState | null };
};
export type ReviewCommandResult = {
  status: 'applied' | 'noop' | 'conflict' | 'rejected';
  reactionId?: string | null; reason?: string; listingVersion?: number;
  currentPrice?: number; contextPrice?: number; contextId?: string; live?: LiveState;
};
export type SearchSaveRequest = {
  commandId: string; searchId: number; expectedVersion: number | null;
  config: Record<string, unknown>; ban: string[]; unban: string[];
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const hex32 = /^[0-9a-f]{32}$/i;
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function exactKeys(value: Record<string, unknown>, allowed: string[]) {
  return Object.keys(value).every(key => allowed.includes(key));
}
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && uuid.test(value);
}
/** 32 hex chars from a Telegram button back to the dispatch UUID. */
export function dispatchIdFromToken(token: unknown): string | null {
  if (typeof token !== 'string') return null;
  if (uuid.test(token)) return token.toLowerCase();
  if (!hex32.test(token)) return null;
  const t = token.toLowerCase();
  return `${t.slice(0, 8)}-${t.slice(8, 12)}-${t.slice(12, 16)}-${t.slice(16, 20)}-${t.slice(20)}`;
}
export function tokenFromDispatchId(id: string): string {
  return id.replace(/-/g, '').toLowerCase();
}
/** Only a canonical eBay listing URL: https, known host, /itm/<digits>, no query. */
export function isListingLink(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 500 || value !== value.trim()) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && /(^|\.)ebay\.(com|co\.uk|de|ca|com\.au)$/.test(url.hostname)
      && !url.username && !url.password && !url.search && !url.hash && /^\/itm\/[0-9]+$/.test(url.pathname);
  } catch {
    return false;
  }
}
/** Trims and strips the query/hash so a variant URL maps to its listing. */
export function normalizeListingLink(value: string): string | null {
  try {
    const url = new URL(value.trim());
    const match = url.pathname.match(/\/itm\/(?:[^/]+\/)*([0-9]+)/);
    if (!match) return null;
    const candidate = `https://${url.hostname}/itm/${match[1]}`;
    return isListingLink(candidate) ? candidate : null;
  } catch {
    return null;
  }
}
export function parseReviewContext(value: unknown): ReviewContextRequest {
  if (!record(value) || !exactKeys(value, ['kind', 'target', 'searchId', 'register']) ||
      !['listing','event','delivery','dispatch'].includes(String(value.kind)) || typeof value.target !== 'string') {
    throw new Error('invalid_context');
  }
  if (value.kind === 'listing') {
    if (!isListingLink(value.target)) throw new Error('invalid_listing_link');
  } else if (value.kind === 'dispatch') {
    if (!dispatchIdFromToken(value.target)) throw new Error('invalid_context_id');
  } else if (!uuid.test(value.target)) throw new Error('invalid_context_id');
  if (value.searchId !== undefined && (value.kind !== 'listing' || !Number.isInteger(value.searchId)
      || Number(value.searchId) <= 0)) throw new Error('invalid_search_scope');
  if (value.register !== undefined && (value.kind !== 'listing' || typeof value.register !== 'boolean')) {
    throw new Error('invalid_register_flag');
  }
  return value as ReviewContextRequest;
}
export function parseReviewCommand(value: unknown): ReviewCommand {
  if (!record(value) || !exactKeys(value, ['commandId','contextId','action','payload','source']) ||
      typeof value.commandId !== 'string' || !uuid.test(value.commandId) ||
      typeof value.contextId !== 'string' || !uuid.test(value.contextId) ||
      !reviewActions.includes(value.action as ReviewAction) || !record(value.payload) ||
      (value.source !== undefined && !['dashboard','dashboard_toast'].includes(String(value.source)))) {
    throw new Error('invalid_command');
  }
  const p = value.payload;
  const action = value.action;
  if (action === 'set_watch') {
    if (!exactKeys(p, ['favorite','super_favorite','desired_price','description']) || p.favorite !== true ||
        (p.super_favorite !== undefined && typeof p.super_favorite !== 'boolean') ||
        !(p.desired_price === null || (typeof p.desired_price === 'number' && Number.isFinite(p.desired_price)
          && p.desired_price > 0 && p.desired_price < 1000000)) ||
        (p.description !== undefined && p.description !== null &&
          (typeof p.description !== 'string' || p.description.length > 2000))) {
      throw new Error('invalid_watch');
    }
    return value as ReviewCommand;
  }
  if (!exactKeys(p, ['days','value','note','reason']) ||
      (p.note !== undefined && (typeof p.note !== 'string' || p.note.length > 4000)) ||
      (p.reason !== undefined && (typeof p.reason !== 'string' || p.reason.length > 1000))) {
    throw new Error('invalid_payload');
  }
  if (['pause','extend_pause'].includes(String(action))) {
    if (typeof p.days !== 'number' || !(PAUSE_DAYS as readonly number[]).includes(p.days)) throw new Error('invalid_pause_days');
  } else if (p.days !== undefined) throw new Error('unexpected_days');
  if (action === 'set_like') {
    if (typeof p.value !== 'boolean') throw new Error('invalid_like');
  } else if (action === 'set_outcome') {
    if (!(manualOutcomes as readonly string[]).includes(String(p.value))) throw new Error('invalid_outcome');
  } else if (p.value !== undefined) throw new Error('unexpected_value');
  if (['clear_outcome','extend_pause'].includes(String(action)) &&
      (typeof p.reason !== 'string' || !p.reason.trim())) throw new Error('reason_required');
  return value as ReviewCommand;
}
const searchConfigKeys = ['categoryid','keywords','brand','model','condition','minprice','maxprice','rate','seller','more_aspects','filters'];
export function parseSearchSave(value: unknown): SearchSaveRequest {
  if (!record(value) || !exactKeys(value, ['commandId','searchId','expectedVersion','config','ban','unban']) ||
      typeof value.commandId !== 'string' || !uuid.test(value.commandId) ||
      !Number.isInteger(value.searchId) || Number(value.searchId) <= 0 ||
      !(value.expectedVersion === null || Number.isInteger(value.expectedVersion)) ||
      !record(value.config) || !exactKeys(value.config, searchConfigKeys) ||
      !Array.isArray(value.ban) || !Array.isArray(value.unban)) {
    throw new Error('invalid_search_save');
  }
  const links = [...value.ban, ...value.unban];
  if (links.length > 200 || !links.every(link => typeof link === 'string' && /^https:\/\//.test(link) && link.length <= 500)) {
    throw new Error('invalid_banned_link');
  }
  if (value.config.filters !== undefined && !record(value.config.filters)) throw new Error('invalid_filters');
  if (value.config.more_aspects !== undefined && value.config.more_aspects !== null &&
      !(Array.isArray(value.config.more_aspects) && value.config.more_aspects.every(x => typeof x === 'string'))) {
    throw new Error('invalid_aspects');
  }
  return value as SearchSaveRequest;
}
