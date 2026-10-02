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
export type DeliveryView={deliveryId:string;eventId:string;dispatchId:string;link:string;channel:'main'|'sniper';kind:string;botId:number;chatId:number;messageId:number;sentAt:string;stateVersion:number;
  resolutionKind:string|null;searchId:number|null;searchExists:boolean;searchName:string|null;outcome:string|null;outcomeNote:string|null;outcomeAt:string|null;outcomeSource:string|null;legacyOutcome:string|null;stage:'new'|'processed'|null;erpDrafts?:number;
  contextPrice:string|null;currentPrice:number|null;title:string|null;manualPurchaseQuantity?:number|null;manualPurchasePendingUnits?:number|null;
  live:{hidden:boolean|null;hiddenUntil:string|null;hidePrice:number|null;favorite:boolean|null;superFavorite:boolean|null;desiredPrice:number|null;bannedInSearch:boolean|null;stockBlocked:boolean;liked:boolean;listingVersion:number}};
export type Menu = 'root' | 'pause' | 'missed' | 'more' | 'change';

/**
 * Legacy super-sniper ACK — the only callback that calls off the escalation
 * ring. Must match ACK_CALLBACK_DATA in the tracker's telegram_notifier.py.
 * Unrelated to the 'ack' review code below, which is namespaced by `rv:`.
 */
export const ackData = 'ack';
/**
 * Shown on main-chat messages of super items so the ring can be called off
 * from the chat the item is actually being read in. The call window is global
 * (one row in sniper_ack), so this button is not scoped to the dispatch and
 * deliberately carries no review callback: review commands never touch it.
 */
export const callOffButton: InlineButton = { text: '🔕 Без дзвінка', callback_data: ackData };

export const callbackCodes = ['ack','bought','hide','pausem','pause','ban','missedm','missed','more','whide',
  'funds','chgm','chg','unhide','unban','back','noop'] as const;
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

export const outcomeLabels:Record<string,string>={bought:'✅ Купив',missed:'⏱ Не встиг',funds:'💰 Кошти / ліміт',bug:'🐞 Баг',hidden:'🙈 Приховано',paused:'⏸ Пауза',banned:'🚫 Бан'};
function shortDate(iso:string|null):string {return iso?new Date(iso).toLocaleDateString('uk-UA',{timeZone:'Europe/Kyiv'}):''}
export function outcomeLabel(view:DeliveryView):string {
  if(!view.outcome)return view.legacyOutcome==='manual_bought'?'Старе «Купив» · без ERP':view.legacyOutcome==='would_hide'?'Старе «Приховав би»':'';
  if(view.outcome==='bought' && view.outcomeSource==='manual')return `✅ Купив · вручну · ${view.manualPurchaseQuantity} шт.`;
  return (outcomeLabels[view.outcome] ?? view.outcome)+(view.outcome==='bought'?` · ERP${view.erpDrafts?' · драфт':''}`:'');
}
export function urlButtons(markup:ReplyMarkup|null|undefined):InlineButton[]{return (markup?.inline_keyboard ?? []).flat().filter(b=>typeof b.url==='string' && b.text)}
export function renderKeyboard(view:DeliveryView,urls:InlineButton[],menu:Menu='root'):ReplyMarkup {
  const token=view.dispatchId.replace(/-/g,''),cb=(code:CallbackCode,arg?:string|number)=>callback(token,code,arg);
  const links=urls.filter(b=>!b.url?.includes('action=bug'));
  const history=links.find(b=>b.url?.includes('/zhezhemon/history'));
  const sniper=links.find(b=>b.url?.includes('/sniper'));
  const balances=links.find(b=>b.url?.includes('/purchase-funding') || /баланс/i.test(b.text));
  const navigation:InlineButton[]=[];
  for(const [button,text] of [[sniper,'🎯'],[balances,'💳'],[history,'📝']] as const)if(button)navigation.push({...button,text});
  const callOff:InlineButton[][]=view.live.superFavorite?[[{...callOffButton}]]:[];
  if(menu==='pause')return {inline_keyboard:[PAUSE_DAYS.map(days=>({text:`⏸ ${days}д`,callback_data:cb('pause',days)})),[{text:'⬅️ Назад',callback_data:cb('back')}],...callOff]};
  const actions:InlineButton[][]=[
    [{text:'🙈 Hide',callback_data:cb('hide')},{text:'⏸ Пауза',callback_data:cb('pausem')},{text:'🚫 Ban',callback_data:cb('ban')},...navigation.filter(b=>b.text==='🎯')],
    [{text:'⏱ Не встиг',callback_data:cb('missed')},{text:'💰 Кошти',callback_data:cb('funds')},...navigation.filter(b=>b.text!=='🎯')],
  ];
  const corrections:InlineButton[]=[];
  if(view.live.hidden)corrections.push({text:'👁 Показати',callback_data:cb('unhide')});
  if(view.live.bannedInSearch)corrections.push({text:'♻️ Зняти бан',callback_data:cb('unban')});
  const result=outcomeLabel(view);
  return {inline_keyboard:[...(result?[[{text:result,callback_data:cb('noop')}]]:[]),
    ...(view.stage==='processed' && menu==='root'?[[{text:'✏️ Змінити результат',callback_data:cb('chgm')}]]:actions),
    ...(corrections.length?[corrections]:[]),...callOff,...(view.stage==='processed' && menu==='root' && navigation.length?[navigation]:[])]};
}

/** Short Ukrainian toast for answerCallbackQuery from a command result. */
export function describeResult(action: string, result: { status: string; reason?: string; currentPrice?: number;
  contextPrice?: number }, view?: DeliveryView | null): string {
  if (result.status === 'applied' || result.status === 'noop') {
    const already = result.status === 'noop' ? ' (вже було)' : '';
    switch (action) {
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
