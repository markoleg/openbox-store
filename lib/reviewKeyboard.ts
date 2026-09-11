/**
 * Main-chat keyboard of the review pipeline, rendered from the server
 * projection (review_delivery_view). Pure: no Telegram, no database.
 *
 * Buttons carry `rv:<dispatch token>:<code>[:<arg>]`; the webhook checks the
 * pressed message's bot/chat/message against that dispatch's delivery. URL
 * buttons (Sniper, Balances, history) are copied from the message's own stored
 * keyboard so a sibling sync never loses its per-message links. The sniper
 * chat keeps its legacy ACK keyboard and never comes through here.
 */
import { PAUSE_DAYS, dispatchIdFromToken } from './reviewCommands.ts';

export type InlineButton = { text: string; url?: string; callback_data?: string };
export type ReplyMarkup = { inline_keyboard: InlineButton[][] };
export type DeliveryView = {
  deliveryId: string; eventId: string; dispatchId: string; link: string; channel: 'main' | 'sniper';
  kind: string; botId: number; chatId: number; messageId: number; sentAt: string; stateVersion: number;
  resolutionKind: 'direct' | 'shared_trigger' | 'event_context' | null;
  searchId: number | null; searchExists: boolean; searchName: string | null;
  firstReactionAt: string | null; outcome: string | null; outcomeReason: string | null;
  outcomeNote: string | null; outcomeAt: string | null; outcomeSource: string | null;
  contextPrice: string | null; currentPrice: number | null; title: string | null;
  live: { hidden: boolean | null; hiddenUntil: string | null; hidePrice: number | null; favorite: boolean | null;
    superFavorite: boolean | null; desiredPrice: number | null; bannedInSearch: boolean | null;
    stockBlocked: boolean; liked: boolean; listingVersion: number };
  review: { id: string; submittedAt: string | null; revisionOpenedAt: string | null; originDeliveryId: string } | null;
};
export type Menu = 'root' | 'pause' | 'missed' | 'more' | 'change';

export const callbackCodes = ['ack','bought','hide','pausem','pause','ban','missedm','missed','more','whide',
  'chgm','chg','unhide','unban','back','noop'] as const;
export type CallbackCode = typeof callbackCodes[number];
export type ReviewCallback = { dispatchId: string; code: CallbackCode; arg: string | null };

export function parseReviewCallback(data: unknown): ReviewCallback | null {
  if (typeof data !== 'string' || data.length > 64 || !data.startsWith('rv:')) return null;
  const parts = data.split(':');
  if (parts.length < 3 || parts.length > 4) return null;
  const dispatchId = dispatchIdFromToken(parts[1]);
  if (!dispatchId || !(callbackCodes as readonly string[]).includes(parts[2])) return null;
  const arg = parts[3] ?? null;
  if (arg !== null && !/^[a-z0-9_]{1,24}$/.test(arg)) return null;
  return { dispatchId, code: parts[2] as CallbackCode, arg };
}

export function callback(token: string, code: CallbackCode, arg?: string | number): string {
  const data = `rv:${token}:${code}${arg === undefined ? '' : ':' + arg}`;
  if (new TextEncoder().encode(data).length > 64) throw new Error('callback_too_long');
  return data;
}

export const outcomeLabels: Record<string, string> = {
  hidden: '🙈 Приховано', paused: '⏸ Пауза', banned: '🚫 Забанено', bought: '✅ Купив',
  would_buy_missed: '⏱ Не встиг', would_hide: '🙈 Приховав би', bug: '🐞 Баг',
};
export const missedReasonLabels: Record<string, string> = {
  sold_out: 'Розкупили', price_changed: 'Ціна змінилась', limit_or_funds: 'Ліміт / кошти', other: 'Інша причина',
};

function shortDate(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Kyiv' });
}

/** What the message currently says about itself, in one label. */
export function outcomeLabel(view: DeliveryView): string {
  if (!view.outcome) return view.firstReactionAt ? '🖐 В роботі' : '';
  let label = outcomeLabels[view.outcome] ?? view.outcome;
  if (view.outcome === 'paused' && view.live.hiddenUntil) label += ` до ${shortDate(view.live.hiddenUntil)}`;
  if (view.outcome === 'banned' && view.searchName) label += ` в «${view.searchName.slice(0, 24)}»`;
  if (view.outcome === 'would_buy_missed' && view.outcomeReason && missedReasonLabels[view.outcomeReason]) {
    label += `: ${missedReasonLabels[view.outcomeReason]}`;
  }
  if (view.resolutionKind === 'event_context') label += ' · з дашборда';
  else if (view.resolutionKind === 'shared_trigger') label += ' · через пов’язане';
  return label;
}

/** URL buttons of the original message, keyed so the layout can place them. */
export function urlButtons(markup: ReplyMarkup | null | undefined): InlineButton[] {
  return (markup?.inline_keyboard ?? []).flat().filter(b => typeof b.url === 'string' && b.text);
}

function withHistoryLabel(button: InlineButton, view: DeliveryView): InlineButton {
  if (!button.url?.includes('/zhezhemon/history')) return button;
  const text = view.review?.originDeliveryId===view.deliveryId ? (view.review.submittedAt && !(view.review.revisionOpenedAt &&
    view.review.revisionOpenedAt > view.review.submittedAt) ? '📝 Переглянути оцінку' : '📝 Оцінити')
    : '📝 Картка та історія';
  return { text, url: button.url };
}

function historyUrl(urls: InlineButton[], action: string): string | null {
  const history = urls.find(b => b.url?.includes('/zhezhemon/history'))?.url;
  if (!history) return null;
  return `${history}${history.includes('?') ? '&' : '?'}action=${encodeURIComponent(action)}`;
}

export function renderKeyboard(view: DeliveryView, urls: InlineButton[], menu: Menu = 'root'): ReplyMarkup {
  const token = view.dispatchId.replace(/-/g, '');
  const cb = (code: CallbackCode, arg?: string | number) => callback(token, code, arg);
  const back: InlineButton = { text: '⬅️ Назад', callback_data: cb('back') };
  const navigation: InlineButton[][] = [];
  const nonHistory = urls.filter(b => !b.url?.includes('/zhezhemon/history'));
  if (nonHistory.length) navigation.push(nonHistory);
  const history = urls.find(b => b.url?.includes('/zhezhemon/history'));
  if (history) navigation.push([withHistoryLabel(history, view)]);

  if (menu === 'pause') {
    return { inline_keyboard: [
      PAUSE_DAYS.map(days => ({ text: `⏸ ${days}д`, callback_data: cb('pause', days) })),
      [back],
    ] };
  }
  if (menu === 'missed') {
    const other = historyUrl(urls, 'missed');
    return { inline_keyboard: [
      [{ text: missedReasonLabels.sold_out, callback_data: cb('missed', 'sold_out') },
       { text: missedReasonLabels.price_changed, callback_data: cb('missed', 'price_changed') }],
      [{ text: missedReasonLabels.limit_or_funds, callback_data: cb('missed', 'limit_or_funds') },
       other ? { text: 'Інша причина…', url: other } : { text: 'Інша причина', callback_data: cb('missed', 'other') }],
      [back],
    ] };
  }
  if (menu === 'more') {
    const bug = historyUrl(urls, 'bug');
    const rows: InlineButton[][] = [
      [{ text: '🙈 Приховав би', callback_data: cb('whide') },
       bug ? { text: '🐞 Баг…', url: bug } : { text: '🐞 Баг…', callback_data: cb('noop') }],
      [{ text: '✏️ Змінити результат', callback_data: cb('chgm') }],
    ];
    const live: InlineButton[] = [];
    if (view.live.hidden) live.push({ text: '👁 Показати знову', callback_data: cb('unhide') });
    if (view.live.bannedInSearch) live.push({ text: '♻️ Зняти бан', callback_data: cb('unban') });
    if (live.length) rows.push(live);
    rows.push([back]);
    return { inline_keyboard: rows };
  }
  if (menu === 'change') {
    const clear = historyUrl(urls, 'clear');
    const bug = historyUrl(urls, 'bug');
    return { inline_keyboard: [
      [{ text: '✅ Купив', callback_data: cb('chg', 'bought') },
       { text: '⏱ Не встиг…', callback_data: cb('missedm') }],
      [{ text: '🙈 Приховав би', callback_data: cb('chg', 'would_hide') },
       bug ? { text: '🐞 Баг…', url: bug } : { text: '🐞 Баг…', callback_data: cb('noop') }],
      ...(clear ? [[{ text: '🧹 Скинути помилковий результат…', url: clear }]] : []),
      [back],
    ] };
  }

  if (view.outcome) {
    return { inline_keyboard: [
      [{ text: outcomeLabel(view), callback_data: cb('noop') }],
      [{ text: '✏️ Змінити результат', callback_data: cb('chgm') }, { text: 'Ще…', callback_data: cb('more') }],
      ...navigation,
    ] };
  }
  const first: InlineButton = view.firstReactionAt
    ? { text: '🖐 В роботі', callback_data: cb('noop') }
    : { text: '🖐 Опрацьовую', callback_data: cb('ack') };
  return { inline_keyboard: [
    [first, { text: '✅ Купив', callback_data: cb('bought') }],
    [{ text: '🙈 Hide', callback_data: cb('hide') }, { text: '⏸ Пауза…', callback_data: cb('pausem') },
     { text: '🚫 Ban', callback_data: cb('ban') }],
    [{ text: 'Не встиг', callback_data: cb('missedm') }, { text: 'Ще…', callback_data: cb('more') }],
    ...navigation,
  ] };
}

/** Short Ukrainian toast for answerCallbackQuery from a command result. */
export function describeResult(action: string, result: { status: string; reason?: string; currentPrice?: number;
  contextPrice?: number }, view?: DeliveryView | null): string {
  if (result.status === 'applied' || result.status === 'noop') {
    const already = result.status === 'noop' ? ' (вже було)' : '';
    switch (action) {
      case 'review_ack': return result.status === 'noop' ? 'Уже в роботі' : 'В роботі';
      case 'hide': return `🙈 Сховано до подешевшання${already}`;
      case 'pause': return `⏸ Пауза${view?.live.hiddenUntil ? ' до ' + shortDate(view.live.hiddenUntil) : ''}${already}`;
      case 'ban': return `🚫 Забанено${view?.searchName ? ' в «' + view.searchName.slice(0, 24) + '»' : ''}${already}`;
      case 'unhide': return `👁 Показано знову${already}`;
      case 'unban': return `♻️ Бан знято${already}`;
      case 'set_outcome': return `Записано${already}`;
      default: return 'Готово';
    }
  }
  if (result.status === 'conflict') {
    switch (result.reason) {
      case 'price_changed': return `Ціна змінилась: $${result.contextPrice} → $${result.currentPrice}. Відкрий картку, щоб обрати поріг`;
      case 'listing_changed': return 'Стан уже змінено в іншому місці — кнопки оновлено';
      case 'result_changed': return 'Результат уже змінено — кнопки оновлено';
      case 'search_changed_or_deleted': return 'Пошук змінено або видалено — бан не застосовано';
      default: return 'Уже змінено — кнопки оновлено';
    }
  }
  switch (result.reason) {
    case 'price_unknown': return 'Ціна повідомлення невідома — відкрий картку';
    case 'not_an_extension': return 'Це не продовження паузи';
    default: return 'Не виконано';
  }
}
