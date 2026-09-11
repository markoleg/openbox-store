/**
 * Browser side of the command API. Every buyer action is: issue a context for
 * exactly what is on screen, then apply one explicit command with a fresh
 * commandId. A network retry reuses the id; a new click gets a new one.
 * Nothing here writes to Supabase directly.
 */
import type { ReviewAction, ReviewCommandResult, ReviewContext, ReviewContextRequest, ReviewPayload, ReviewSource }
  from '@/lib/reviewCommands';

export type ReviewTarget =
  | { kind: 'listing'; link: string; searchId?: number; register?: boolean }
  | { kind: 'event'; eventId: string }
  | { kind: 'delivery'; deliveryId: string }
  | { kind: 'dispatch'; token: string };

export class ReviewError extends Error {
  constructor(public code: string, public status: number) { super(code); }
}

function toRequest(target: ReviewTarget): ReviewContextRequest {
  switch (target.kind) {
    case 'listing': return { kind: 'listing', target: target.link,
      ...(target.searchId ? { searchId: target.searchId } : {}), ...(target.register ? { register: true } : {}) };
    case 'event': return { kind: 'event', target: target.eventId };
    case 'delivery': return { kind: 'delivery', target: target.deliveryId };
    case 'dispatch': return { kind: 'dispatch', target: target.token };
  }
}

async function post(path: string, body: unknown, retryOnce = false): Promise<Response> {
  try {
    return await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body), credentials: 'same-origin' });
  } catch (error) {
    if (retryOnce) return post(path, body, false);
    throw error;
  }
}

async function failed(response: Response): Promise<never> {
  if (response.status === 401 && typeof window !== 'undefined') {
    const next = window.location.pathname + window.location.search;
    window.location.href = `/login?next=${encodeURIComponent(next)}`;
  }
  let code = `http_${response.status}`;
  try { code = String((await response.json())?.error ?? code); } catch { /* keep status */ }
  throw new ReviewError(code, response.status);
}

export async function issueContext(target: ReviewTarget): Promise<ReviewContext> {
  const response = await post('/api/review/contexts', toRequest(target));
  if (!response.ok) return failed(response);
  return response.json();
}

export async function applyCommand(contextId: string, action: ReviewAction, payload: ReviewPayload = {},
  source: ReviewSource = 'dashboard'): Promise<ReviewCommandResult> {
  const body = { commandId: crypto.randomUUID(), contextId, action, payload, source };
  // The same commandId survives one transport retry: same receipt, same fact.
  const response = await post('/api/review/commands', body, true);
  if (response.ok || response.status === 409 || response.status === 422) {
    const result = await response.json().catch(() => null);
    if (result && typeof result.status === 'string') return result as ReviewCommandResult;
  }
  return failed(response);
}

/** Context for what is on screen, then the command. */
export async function runCommand(target: ReviewTarget, action: ReviewAction, payload: ReviewPayload = {},
  source: ReviewSource = 'dashboard'): Promise<{ context: ReviewContext; result: ReviewCommandResult }> {
  const context = await issueContext(target);
  const result = await applyCommand(context.id, action, payload, source);
  return { context, result };
}

export async function saveSearch(body: { searchId: number; expectedVersion: number | null;
  config: Record<string, unknown>; ban: string[]; unban: string[] }) {
  const response = await post('/api/review/searches', { commandId: crypto.randomUUID(), ...body }, true);
  if (response.ok || response.status === 409 || response.status === 422) {
    const result = await response.json().catch(() => null);
    if (result && typeof result.status === 'string') return result as { status: string; reason?: string;
      reviewVersion?: number; banned?: string[]; current?: Record<string, unknown>; reactions?: number };
  }
  return failed(response);
}

const actionDone: Record<string, string> = {
  hide: 'Сховано до подешевшання', unhide: 'Показано знову', pause: 'Пауза встановлена', extend_pause: 'Паузу продовжено',
  ban: 'Забанено в пошуку', unban: 'Бан знято', set_like: 'Лайк збережено', review_ack: 'В роботі',
  set_outcome: 'Результат записано', clear_outcome: 'Результат скинуто', set_watch: 'Sniper збережено',
  remove_watch: 'Прибрано зі Sniper',
};

/** One short Ukrainian line for a toast; errors are never shown as success. */
export function explainResult(action: ReviewAction, result: ReviewCommandResult): { ok: boolean; text: string } {
  if (result.status === 'applied') return { ok: true, text: actionDone[action] ?? 'Готово' };
  if (result.status === 'noop') return { ok: true, text: `${actionDone[action] ?? 'Готово'} (без змін)` };
  if (result.status === 'conflict') {
    switch (result.reason) {
      case 'price_changed': return { ok: false, text: `Ціна змінилась: $${result.contextPrice} → $${result.currentPrice}` };
      case 'listing_changed': return { ok: false, text: 'Вже змінено в іншому місці — стан оновлено' };
      case 'result_changed': return { ok: false, text: 'Результат уже змінено — стан оновлено' };
      case 'search_changed_or_deleted': return { ok: false, text: 'Пошук змінено або видалено' };
      case 'command_id_reused': return { ok: false, text: 'Повтор команди з іншими даними' };
      default: return { ok: false, text: 'Вже змінено — стан оновлено' };
    }
  }
  switch (result.reason) {
    case 'price_unknown': return { ok: false, text: 'Невідома ціна — сховати неможливо' };
    case 'notification_context_required': return { ok: false, text: 'Потрібне конкретне повідомлення' };
    case 'not_an_extension': return { ok: false, text: 'Це не продовження паузи' };
    default: return { ok: false, text: 'Не виконано' };
  }
}

export function explainError(error: unknown): string {
  if (error instanceof ReviewError) {
    if (error.status === 503 && error.code === 'disabled') return 'Команди вимкнені на сервері';
    if (error.status === 401) return 'Потрібен вхід';
    if (error.status === 403) return 'Заборонено';
    if (error.status === 422) return 'Сервер відхилив запит';
    if (error.status === 503) return 'Сервер недоступний, спробуй ще раз';
    return `Помилка: ${error.code}`;
  }
  return 'Немає зв’язку з сервером';
}
