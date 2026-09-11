import 'server-only';
import { reviewDatabase } from './reviewCommands';
import type { Assessment, AssessmentRequest, BoardCard, BoardPage, Cursor, Stage, BoardFilters, Board } from '@/lib/reviewBoards';
import type { DeliveryView } from '@/lib/reviewKeyboard';
import { deliveryView, listingHistory } from './reviewCommands';

async function checked<T>(query: PromiseLike<{data: T; error: unknown}>): Promise<T> {
  const {data,error}=await query;
  if (error) throw new Error('review_storage_failed');
  return data;
}
export async function readBoard(board: Board, filters: BoardFilters, cursors: Partial<Record<Stage,Cursor>>): Promise<BoardPage> {
  return checked(reviewDatabase().rpc('review_board',{p_board:board,p_filters:filters,p_cursors:cursors})) as Promise<BoardPage>;
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
};
export async function readCard(board: Board, id: string): Promise<CardDetail | null> {
  const db=reviewDatabase();
  const card=await checked(db.from('review_board_rows').select('*').eq('board',board).eq('id',id).maybeSingle()) as BoardCard | null;
  if (!card) return null;
  const [view,review,event,delivery,history] = await Promise.all([
    deliveryView(card.delivery_id),
    card.review_id ? checked(db.from('listing_reviews').select('*').eq('id',card.review_id).single()) : null,
    checked(db.from('notification_events').select('summary_snapshot_id,search_snapshot').eq('id',card.event_id).single()),
    checked(db.from('notification_deliveries').select('attempt_id').eq('id',card.delivery_id).single()),
    listingHistory(card.link),
  ]);
  const attempt=delivery?.attempt_id ? await checked(db.from('notification_dispatch_attempts').select('context_snapshot_id').eq('id',delivery.attempt_id).single()) : null;
  const snapshotId=(board==='review' ? review?.evaluation_snapshot_id : null) ?? attempt?.context_snapshot_id ?? event?.summary_snapshot_id;
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
  return {card,view,review:review as Assessment | null,snapshot,photos,search:event?.search_snapshot ?? {},history,revisions,missingSources} as CardDetail;
}
