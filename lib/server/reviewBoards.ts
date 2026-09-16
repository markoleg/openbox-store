import 'server-only';
import { reviewDatabase } from './reviewCommands';
import type { Assessment, AssessmentRequest, BoardCard, BoardPage, Cursor, Stage, BoardFilters, Board } from '@/lib/reviewBoards';
import type { DeliveryView } from '@/lib/reviewKeyboard';
import { deliveryView, listingHistory } from './reviewCommands';
import { projectStock } from '@/lib/reviewStock';
import { stages } from '@/lib/reviewBoards';
import { capturedListingView, type CapturedListingView } from '@/lib/capturedListing';
import { sanitizeDescription, type SafeDescription } from '@/lib/sanitizeDescription';

type StoredCard = Omit<BoardCard,'stock_quantity'> & {stock_evidence:unknown};

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
export type CardDetail = {
  card: BoardCard; view: DeliveryView | null; review: Assessment | null;
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
  const card=projectStock(stored);
  const [view,review,event,history] = await Promise.all([
    deliveryView(card.delivery_id),
    card.review_id ? checked(db.from('listing_reviews').select('*').eq('id',card.review_id).single()) : null,
    checked(db.from('notification_events').select('summary_snapshot_id,search_snapshot').eq('id',card.event_id).single()),
    listingHistory(card.link),
  ]);
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
  return {card,view,review:review as Assessment | null,snapshot,photos,search,history,revisions,missingSources,
    captured:{...captured,descriptionSource:null},description} as CardDetail;
}
