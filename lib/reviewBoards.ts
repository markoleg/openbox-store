/** Shared, pure contracts. No service credentials or database imports here. */
import type { StockQuantity } from './reviewStock.ts';
export const criteria = [
  ['title', 'Заголовок'], ['shop', 'Магазин'], ['aspects', 'Параметри'],
  ['description', 'Опис'], ['photos', 'Фото'], ['price_shipping', 'Ціна з доставкою'],
] as const;
export type Criterion = typeof criteria[number][0];
export type Board = 'review' | 'notifications';
export type Stage = 'new' | 'working' | 'done';
export const stages: Stage[] = ['new', 'working', 'done'];
export type BoardFilters = Partial<Record<'search' | 'link' | 'outcome' | 'stage' | 'kind' | 'channel' | 'condition' | 'from' | 'to', string>> &
  {needsReaction?: boolean; withoutReview?: boolean};
export type Cursor = {at: string; id: string};
export type BoardCard = {
  board: Board; id: string; link: string; card_at: string; stage: Stage; delivery_id: string;
  review_id: string | null; event_id: string; search_id: number | null; search_name: string | null;
  kind: string; channel: string; condition_id: string | null; title: string; price: string | null; currency: string | null;
  outcome: string | null; first_reaction_at: string | null; outcome_at: string | null;
  resolution_kind: string | null; sent_at: string; missing: number | null;
  hidden: boolean; hidden_until: string | null; favorite: boolean; stock_blocked: boolean;
  stock_snapshot_id: string | null; stock_observed_at: string | null; stock_quantity: StockQuantity | null;
};
export type BoardPage = {columns: Record<Stage, {count: number; cards: BoardCard[]}>; pending: number; searches?:{id:number;name:string|null}[]};
export type Assessment = {
  id: string; link: string; origin_delivery_id: string; version: number; submitted_at: string | null;
  revision_opened_at: string | null; decision_reaction_id: string | null; decision_note: string | null;
  evaluation_snapshot_id: string | null; rubric_version: number; photo_notes: Record<string, string>;
} & Record<`score_${Criterion}`, number | null> & Record<`note_${Criterion}`, string | null>;
export type AssessmentRequest = {commandId: string; reviewId: string; version: number; action: 'draft' | 'submit' | 'reopen'; payload: Record<string, unknown>};
const uuid = (s: unknown): s is string => typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
const object = (o: unknown): o is Record<string, unknown> => !!o && typeof o === 'object' && !Array.isArray(o);
export function isSubmitted(r: Pick<Assessment, 'submitted_at' | 'revision_opened_at'>): boolean {
  return !!r.submitted_at && (!r.revision_opened_at || Date.parse(r.revision_opened_at) <= Date.parse(r.submitted_at));
}
export function parseAssessment(value: unknown): AssessmentRequest {
  if (!object(value) || Object.keys(value).some(k => !['commandId','reviewId','version','action','payload'].includes(k)) ||
    !uuid(value.commandId) || !uuid(value.reviewId) || !Number.isSafeInteger(value.version) || Number(value.version)<0 ||
    !['draft','submit','reopen'].includes(String(value.action)) || !object(value.payload)) throw new Error('invalid_assessment');
  for (const [key, val] of Object.entries(value.payload)) {
    if (value.action === 'reopen') {
      if (key !== 'reason' || typeof val !== 'string' || !val.trim() || val.length>1000) throw new Error('invalid_reason');
    } else if (criteria.some(([k]) => key === `score_${k}`)) {
      if (val !== null && (!Number.isInteger(val) || Number(val)<1 || Number(val)>5)) throw new Error('invalid_score');
    } else if (criteria.some(([k]) => key === `note_${k}`) || key === 'decision_note') {
      if (val !== null && (typeof val !== 'string' || val.length>4000)) throw new Error('invalid_note');
    } else if (key === 'photo_notes') {
      if (!object(val) || JSON.stringify(val).length>16000 || Object.entries(val).some(([url,note])=>url.length>2000 || typeof note!=='string' || note.length>2000)) throw new Error('invalid_photo_notes');
    } else if (key === 'decision_reaction_id') {
      if (val !== null && !uuid(val)) throw new Error('invalid_decision');
    } else throw new Error('unknown_field');
  }
  if (value.action === 'reopen' && !String(value.payload.reason ?? '').trim()) throw new Error('reason_required');
  return value as AssessmentRequest;
}
export function parseBoardQuery(params: URLSearchParams): {board: Board; filters: BoardFilters; cursors: Partial<Record<Stage, Cursor>>} {
  const board = params.get('tab') ?? 'review';
  if (board !== 'review' && board !== 'notifications') throw new Error('invalid_board');
  const filters: BoardFilters = {};
  for (const key of ['search','link','outcome','stage','kind','channel','condition','from','to'] as const) {
    const value = params.get(key);
    if (!value) continue;
    if (value.length>500) throw new Error('filter_too_long');
    if (['search','condition'].includes(key) && !(key==='search' && value==='deleted') && !/^[1-9][0-9]{0,8}$/.test(value)) throw new Error('invalid_number');
    if (['from','to'].includes(key) && (!/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(Date.parse(value)))) throw new Error('invalid_date');
    filters[key] = value;
  }
  if (filters.from && filters.to && Date.parse(filters.from)>=Date.parse(filters.to)) throw new Error('invalid_range');
  for (const key of ['needsReaction','withoutReview'] as const) if (params.get(key)==='true') filters[key]=true;
  const cursors: Partial<Record<Stage, Cursor>> = {};
  for (const stage of stages) {
    const at=params.get(`${stage}At`), id=params.get(`${stage}Id`);
    if (at || id) {
      if (!at || !uuid(id) || !Number.isFinite(Date.parse(at))) throw new Error('invalid_cursor');
      cursors[stage]={at,id};
    }
  }
  return {board,filters,cursors};
}
export const dateLabel = (iso: string | null) => iso ? new Date(iso).toLocaleString('uk-UA', {timeZone:'Europe/Kyiv'}) : '—';
export function searchLabel(search:{search_id:number|null;search_name:string|null}):string {
  if(search.search_id===null)return search.search_name?`${search.search_name} (пошук видалено)`:'Пошук видалено';
  return search.search_name || `Пошук #${search.search_id}`;
}
export function reactionDelay(sent: string, reacted: string | null): string {
  if (!reacted) return 'немає прямої реакції';
  const seconds=Math.floor((Date.parse(reacted)-Date.parse(sent))/1000);
  if (!Number.isFinite(seconds)) return 'час невідомий';
  if (seconds<0) return 'реакція до доставки';
  if (seconds<60) return `${seconds} с`;
  if (seconds<3600) return `${Math.floor(seconds/60)} хв`;
  return `${Math.floor(seconds/3600)} год ${Math.floor(seconds%3600/60)} хв`;
}
export function historyBoardDestination(delivery: {deliveryId:string;review:{id:string;originDeliveryId:string}|null},action?:string): string {
  const params=delivery.review?.originDeliveryId===delivery.deliveryId && !action
    ? new URLSearchParams({tab:'review',review:delivery.review.id})
    : new URLSearchParams({tab:'notifications',delivery:delivery.deliveryId,...(action?{action}:{})});
  return `/zhezhemon/processing?${params}`;
}

/** Shareable URL holds both tabs' independent filters. No storage-only state. */
export function tabFilters(params: URLSearchParams, board: Board): URLSearchParams {
  const result = new URLSearchParams({tab:board});
  params.forEach((v,k) => { if (k.startsWith(`${board}.`)) result.set(k.slice(board.length+1),v); });
  return result;
}
