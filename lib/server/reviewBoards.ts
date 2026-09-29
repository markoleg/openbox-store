import 'server-only';
import { reviewDatabase } from './reviewCommands';
import type { Assessment, AssessmentRequest, BoardCard, BoardPage, Cursor, Stage, BoardFilters, Board, CardPartNumber,
  CardErpPurchases, PartNumberRequest, PartNumberSource, PartNumberStatus } from '@/lib/reviewBoards';
import type { DeliveryView } from '@/lib/reviewKeyboard';
import { deliveryView, listingHistory } from './reviewCommands';
import { projectStock } from '@/lib/reviewStock';
import { stages } from '@/lib/reviewBoards';
import { capturedListingView, type CapturedListingView } from '@/lib/capturedListing';
import { sanitizeDescription, type SafeDescription } from '@/lib/sanitizeDescription';

type StoredCard = Omit<BoardCard,'stock_quantity'> & {stock_evidence:unknown};
/** One listing_part_numbers row: the CRM's resolution kept apart from the manual value. */
export type ListingPartNumber = {
  part_number: string | null; status: PartNumberStatus; source: PartNumberSource | null;
  manual_part_number: string | null; manual_by: string | null; manual_at: string | null;
  version: number; crm_checked_at: string | null;
};
/** One listing_erp_purchases row: units of one product bought from the listing in one ERP purchase. */
export type ListingErpPurchase = {
  erp_purchase_id: number; erp_product_id: number; model_number: string | null; purchase_condition_class: 'NEW' | 'OPENBOX' | null;
  purchase_date: string; units: number; cancelled_units: number; first_synced_at: string;
  removed_at: string | null; reaction_id: string | null;
};
export type PartNumberResult = {status: 'applied' | 'noop' | 'conflict' | 'rejected'; reason?: string; partNumber?: ListingPartNumber};

async function checked<T>(query: PromiseLike<{data: T; error: unknown}>): Promise<T> {
  const {data,error}=await query;
  if (error) throw new Error('review_storage_failed');
  return data;
}
export async function readBoard(board: Board, filters: BoardFilters, cursors: Partial<Record<Stage,Cursor>>): Promise<BoardPage> {
  const page=await checked(reviewDatabase().rpc('review_board',{p_board:board,p_filters:filters,p_cursors:cursors})) as
    Omit<BoardPage,'columns'> & {columns:Record<Stage,{count:number;cards:StoredCard[]}>};
  return {...page,columns:Object.fromEntries(stages.map(stage=>[stage,{
    ...page.columns[stage],cards:page.columns[stage].cards.map(projectStock),
  }])) as BoardPage['columns']};
}
export async function saveAssessment(request: AssessmentRequest) {
  const {data,error}=await reviewDatabase().rpc('save_listing_assessment',{
    p_command:request.commandId,p_review:request.reviewId,p_version:request.version,p_action:request.action,p_payload:request.payload,
  });
  if (error) throw new Error(['22023','22P02','23514','P0002'].includes(error.code) ? 'invalid_assessment' : 'review_storage_failed');
  return data as {status:string; reason?:string; version?:number};
}
/** set_listing_part_number: idempotent per commandId; the actor comes from the session, never the client. */
export async function savePartNumber(request: PartNumberRequest, actor: string): Promise<PartNumberResult> {
  const {data,error}=await reviewDatabase().rpc('set_listing_part_number',{
    p_command:request.commandId,p_link:request.link,p_part_number:request.partNumber,
    p_expected_version:request.version,p_actor:actor,
  });
  if (error) throw new Error(['22023','22P02','23514'].includes(error.code) ? 'invalid_part_number' : 'review_storage_failed');
  return data as PartNumberResult;
}
export type CardDetail = {
  card: BoardCard; view: DeliveryView | null; review: Assessment | null;
  partNumber: ListingPartNumber | null;
  erpPurchases: ListingErpPurchase[];
  snapshot: {id:string; observed_at:string; source:string; normalized_payload: Record<string,unknown>; raw_payload:Record<string,unknown> | null} | null;
  photos: {source_url:string; status:string; content_hash:string | null}[];
  search: Record<string,unknown>;
  history: Awaited<ReturnType<typeof listingHistory>>;
  revisions: {version:number; reason:string; recorded_at:string; payload:Assessment}[];
  missingSources: string[];
  captured: CapturedListingView;
  description: SafeDescription;
};
export async function readCard(board: Board, id: string): Promise<CardDetail | null> {
  const db=reviewDatabase();
  const stored=await checked(db.from('review_board_rows').select('*').eq('board',board).eq('id',id).maybeSingle()) as StoredCard | null;
  if (!stored) return null;
  const [view,review,event,history,partNumber,erpPurchases,buyerBought] = await Promise.all([
    deliveryView(stored.delivery_id),
    stored.review_id ? checked(db.from('listing_reviews').select('*').eq('id',stored.review_id).single()) : null,
    checked(db.from('notification_events').select('summary_snapshot_id,search_snapshot').eq('id',stored.event_id).single()),
    listingHistory(stored.link),
    // review_board_rows stays as migration 016 defines it; the part number is joined here, as review_board does.
    checked(db.from('listing_part_numbers').select('part_number,status,source,manual_part_number,manual_by,manual_at,version,crm_checked_at')
      .eq('link',stored.link).maybeSingle()) as Promise<ListingPartNumber | null>,
    // Removed purchases stay listed, marked, so a withdrawn system reaction is explained.
    checked(db.from('listing_erp_purchases').select('erp_purchase_id,erp_product_id,model_number,purchase_condition_class,purchase_date,units,cancelled_units,first_synced_at,removed_at,reaction_id')
      .eq('link',stored.link).order('purchase_date',{ascending:false}).order('erp_purchase_id',{ascending:false})) as Promise<ListingErpPurchase[]>,
    checked(db.from('listing_reactions').select('id').eq('link',stored.link).eq('actor_id','buyer').eq('outcome','bought').limit(1)) as Promise<{id:string}[]>,
  ]);
  const card=projectStock({...stored,...cardPartNumber(partNumber),...cardErpPurchases(erpPurchases,buyerBought.length>0)});
  // Use the same historical source selected for the tile, not mutable latest data.
  const snapshotId=card.stock_snapshot_id;
  const [snapshot,photos,revisions]=await Promise.all([
    snapshotId ? checked(db.from('listing_snapshots').select('id,observed_at,source,normalized_payload,raw_payload').eq('id',snapshotId).single()) : null,
    snapshotId ? checked(db.from('snapshot_photos').select('source_url,status,content_hash').eq('snapshot_id',snapshotId).order('position')) : [],
    card.review_id ? checked(db.from('listing_review_revisions').select('version,reason,recorded_at,payload').eq('review_id',card.review_id).order('version',{ascending:false})) : [],
  ]);
  const missingSources=await checked(db.rpc('review_missing_sources',{p_snapshot:snapshotId ?? null}));
  // A frozen training label may be older than the recent-history window.
  // Always include that exact decision, not a newer result for the same link.
  if(review?.decision_reaction_id && !history.reactions.some(r=>r.id===review.decision_reaction_id)) {
    const decision=await checked(db.from('listing_reactions').select('id, action, outcome, reason_code, note, source, received_at, delivery_id, event_id, supersedes_reaction_id')
      .eq('id',review.decision_reaction_id).single());
    if(!decision) throw new Error('review_decision_unavailable');
    history.reactions.push(decision);
  }
  const search=event?.search_snapshot?.params ?? {};
  // Readable projection and sanitized seller HTML are built here; the browser never parses raw eBay payloads.
  const captured=capturedListingView({snapshot,search,photoCount:(photos ?? []).length,conditionId:card.condition_id});
  const description=sanitizeDescription(captured.descriptionSource);
  // The original description already travels inside raw_payload for the technical block.
  return {card,view,review:review as Assessment | null,partNumber,erpPurchases,snapshot,photos,search,history,revisions,missingSources,
    captured:{...captured,descriptionSource:null},description} as CardDetail;
}
function cardPartNumber(row: ListingPartNumber | null): CardPartNumber {
  return {part_number:row?.part_number ?? null,part_number_status:row?.status ?? null,part_number_source:row?.source ?? null,
    manual_part_number:row?.manual_part_number ?? null,part_number_version:row?.version ?? null};
}
/** The same aggregate review_board computes, so the open card matches its tile. */
function cardErpPurchases(rows: ListingErpPurchase[], buyerBought: boolean): CardErpPurchases {
  const live=rows.filter(row=>!row.removed_at), bought=live.filter(row=>row.units>0);
  return {erp_units:live.reduce((sum,row)=>sum+row.units,0),erp_purchases:bought.length,
    erp_last_purchase_date:bought.map(row=>row.purchase_date).sort().at(-1) ?? null,buyer_bought:buyerBought};
}
