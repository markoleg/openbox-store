/** Operational notification queue contracts. */
import type { StockQuantity } from './reviewStock.ts';
import type { ListingPhoto } from './listingPhotos.ts';
export type Board = 'notifications';
export type Stage = 'new' | 'processed';
export const stages: Stage[] = ['new','processed'];
export const eventLabels:Record<string,string>={first_seen:'Перша поява',returned:'Повернення',price_drop:'Подешевшання',pause_over:'Після паузи',availability_restored:'Знову доступно'};
export type BoardFilters = Partial<Record<'search'|'link'|'outcome'|'stage'|'kind'|'condition'|'from'|'to'|'partNumber',string>>;
export const partNumberFilters = ['missing','not_in_catalog'] as const;
export type PartNumberStatus = 'identified'|'not_in_catalog'|'ambiguous'|'unknown'|'unverified';
export type PartNumberSource = 'purchase'|'mpn'|'title'|'manual'|'listing_mpn';
export type CardPartNumber = {part_number:string|null;part_number_status:PartNumberStatus|null;part_number_source:PartNumberSource|null;manual_part_number:string|null;part_number_version:number|null};
export type CardErpPurchases = {erp_units:number;erp_purchases:number;erp_unknown_quantities:number;erp_drafts:number;listing_erp_purchases:number;listing_erp_units:number;erp_candidates:number};
export type BoardCard = {board:Board;id:string;event_id:string;delivery_id:string;link:string;card_at:string;sent_at:string;stage:Stage;photos?:ListingPhoto[];
  search_id:number|null;search_name:string|null;kind:string;channel:'main';condition_id:string|null;title:string;price:string|null;currency:string|null;
  outcome:string|null;manual_outcome:string|null;legacy_outcome:string|null;note:string|null;outcome_at:string|null;state_version:number;
  hidden:boolean;hidden_until:string|null;favorite:boolean;stock_blocked:boolean;
  stock_snapshot_id:string|null;stock_observed_at:string|null;stock_quantity:StockQuantity|null} & CardPartNumber & CardErpPurchases;
export type Cursor = {at:string;id:string};
/** version: the change signal read before the page; a later, higher one means the page may be stale. */
export type BoardPage = {columns:Record<Stage,{count:number;cards:BoardCard[]}>;pending:number;searches?:{id:number;name:string|null}[];version?:number};
const uuid = (s:unknown):s is string=>typeof s==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const object = (o:unknown):o is Record<string,unknown>=>!!o && typeof o==='object' && !Array.isArray(o);
export function parseBoardQuery(params:URLSearchParams):{board:Board;filters:BoardFilters;cursors:Partial<Record<Stage,Cursor>>} {
  if(params.has('tab') && params.get('tab')!=='notifications') throw new Error('invalid_board');
  const filters:BoardFilters={};
  for(const key of ['search','link','outcome','stage','kind','condition','from','to','partNumber'] as const){
    const value=params.get(key);if(!value)continue;
    if(value.length>500)throw new Error('filter_too_long');
    if(key==='stage' && !stages.includes(value as Stage))throw new Error('invalid_stage');
    if(key==='outcome' && !['bought','missed','funds','bug','hidden','paused','banned'].includes(value))throw new Error('invalid_outcome');
    if(key==='partNumber' && !(partNumberFilters as readonly string[]).includes(value))throw new Error('invalid_part_number_filter');
    if(['search','condition'].includes(key) && !(key==='search' && value==='deleted') && !/^[1-9][0-9]{0,8}$/.test(value))throw new Error('invalid_number');
    if(['from','to'].includes(key) && (!/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(Date.parse(value))))throw new Error('invalid_date');
    filters[key]=value;
  }
  if(filters.from && filters.to && Date.parse(filters.from)>=Date.parse(filters.to))throw new Error('invalid_range');
  const cursors:Partial<Record<Stage,Cursor>>={};
  for(const stage of stages){const at=params.get(stage+'At'),id=params.get(stage+'Id');if(at || id){if(!at || !uuid(id) || !Number.isFinite(Date.parse(at)))throw new Error('invalid_cursor');cursors[stage]={at,id}}}
  return {board:'notifications',filters,cursors};
}
/** Same rule as set_listing_part_number: trimmed, upper-cased, 3–64 of A–Z 0–9 / + -. */
export const PART_NUMBER_PATTERN = /^[A-Z0-9][A-Z0-9/+-]{2,63}$/;
export const normalizePartNumber = (value: string): string | null => value.trim().toUpperCase() || null;
export type PartNumberRequest = {commandId: string; link: string; partNumber: string | null; version: number | null};
/** A null part number clears the manual value; a null version means "no row seen yet". */
export function parsePartNumberRequest(value: unknown): PartNumberRequest {
  if (!object(value) || Object.keys(value).some(k => !['commandId','link','partNumber','version'].includes(k)) ||
    !uuid(value.commandId) || typeof value.link !== 'string' || !/^https:\/\//.test(value.link) || value.link.length>500)
    throw new Error('invalid_part_number_request');
  if (value.version !== null && (!Number.isSafeInteger(value.version) || Number(value.version)<1)) throw new Error('invalid_version');
  if (value.partNumber !== null && typeof value.partNumber !== 'string') throw new Error('invalid_part_number');
  const partNumber = value.partNumber === null ? null : normalizePartNumber(value.partNumber);
  if (partNumber !== null && !PART_NUMBER_PATTERN.test(partNumber)) throw new Error('invalid_part_number');
  return {commandId: value.commandId, link: value.link, partNumber, version: value.version as number | null};
}
export const partNumberSourceLabels: Record<PartNumberSource, string> = {
  purchase: 'з закупівлі цього лінка', mpn: 'з MPN оголошення', title: 'із заголовка', manual: 'вручну',
  listing_mpn: 'сирий MPN, ERP не відповіла',
};
export type PartNumberBadge = {label: string; tone: 'known' | 'missing' | 'catalog' | 'pending'};
/** Tile badge: what is known about the listing's part number and whether a person must act. */
export function partNumberBadge(card: CardPartNumber): PartNumberBadge {
  const {part_number: pn, part_number_status: status, part_number_source: source, manual_part_number: manual} = card;
  if (manual) {
    if (source !== 'manual') return {label: `✍️ ${manual} · чекає ERP`, tone: 'pending'};
    if (status === 'identified') return {label: `✍️ ${pn}`, tone: 'known'};
    if (status === 'not_in_catalog') return {label: `✍️ ${pn} · немає в ERP`, tone: 'catalog'};
    return {label: `✍️ ${manual} · ERP не визначила`, tone: 'missing'};
  }
  if (status === 'identified') return {label: String(pn), tone: 'known'};
  if (status === 'not_in_catalog') return {label: `${pn} · немає в ERP`, tone: 'catalog'};
  if (status === 'unverified') return {label: `${pn}? · не перевірено`, tone: 'missing'};
  if (status === 'ambiguous') return {label: 'Кілька товарів · вкажи партійний', tone: 'missing'};
  return {label: 'Без партійного', tone: 'missing'};
}

export function erpPurchaseBadge(card:CardErpPurchases):string|null {
  if(!card.erp_purchases)return null;
  const quantity=card.erp_unknown_quantities===card.erp_purchases?'кількість невідома':`${card.erp_units} шт${card.erp_unknown_quantities?' + невідома кількість':''}`;
  return `ERP${card.erp_drafts?' · драфт':''} · ${card.erp_purchases} закуп. · ${quantity}`;
}
export const dateLabel = (iso:string|null)=>iso?new Date(iso).toLocaleString('uk-UA',{timeZone:'Europe/Kyiv'}):'—';
export function searchLabel(search:{search_id:number|null;search_name:string|null}):string {
  return search.search_id===null?(search.search_name?`${search.search_name} (пошук видалено)`:'Пошук видалено'):search.search_name || `Пошук #${search.search_id}`;
}
export function tabFilters(params:URLSearchParams,board:Board):URLSearchParams {
  const result=new URLSearchParams({tab:board});params.forEach((v,k)=>{if(k.startsWith(board+'.'))result.set(k.slice(board.length+1),v)});return result;
}
