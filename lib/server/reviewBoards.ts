import 'server-only';
import {reviewDatabase} from './reviewCommands';
import {stages,type Board,type BoardCard,type BoardPage,type BoardFilters,type Cursor,type Stage,type PartNumberRequest,type PartNumberStatus,type PartNumberSource} from '@/lib/reviewBoards';
import type {DeliveryView} from '@/lib/reviewKeyboard';
import {projectStock} from '@/lib/reviewStock';
import {capturedListingView,type CapturedListingView} from '@/lib/capturedListing';
import {sanitizeDescription,type SafeDescription} from '@/lib/sanitizeDescription';
import {availablePhotos,type ListingPhoto} from '@/lib/listingPhotos';
type StoredCard=Omit<BoardCard,'stock_quantity'> & {stock_evidence:unknown};
export type ListingPartNumber = {
  part_number: string | null; status: PartNumberStatus; source: PartNumberSource | null;
  manual_part_number: string | null; manual_by: string | null; manual_at: string | null;
  version: number; crm_checked_at: string | null;
};
export type ListingErpPurchase = {
  order_key:string;lifecycle:'draft'|'purchase'|'withdrawn';draft_id:number|null;purchase_id:number|null;
  quantity:number|null;cancelled_units:number;quantity_basis:string;email_at:string|null;ordered_at:string|null;scope_date:string;
  draft_created_at:string|null;purchase_created_at:string|null;time_basis:string;active:boolean;assigned_event_id:string|null;
  assignment_source:'automatic'|'manual'|'excluded';version:number;first_synced_at:string;
};
export type PartNumberResult={status:'applied'|'noop'|'conflict'|'rejected';reason?:string;partNumber?:ListingPartNumber;current?:ListingPartNumber};
async function checked<T>(query:PromiseLike<{data:T;error:unknown}>):Promise<T>{const {data,error}=await query;if(error)throw new Error('review_storage_failed');return data}
/** The board change signal: every delivery, outcome, live listing, part number and ERP change bumps it. */
export async function readBoardVersion():Promise<number>{
  const row=await checked(reviewDatabase().from('review_realtime_signal').select('version').eq('id',1).single()) as {version:number};
  return Number(row.version);
}
export async function readBoard(board:Board,filters:BoardFilters,cursors:Partial<Record<Stage,Cursor>>):Promise<BoardPage>{
  // Read before the page, so a change landing in between shows up as a newer version.
  const version=await readBoardVersion();
  const page=await checked(reviewDatabase().rpc('review_board',{p_board:board,p_filters:filters,p_cursors:cursors})) as Omit<BoardPage,'columns'> & {columns:Record<Stage,{count:number;cards:StoredCard[]}>};
  const snapshots=[...new Set(stages.flatMap(stage=>page.columns[stage].cards.map(card=>card.stock_snapshot_id)).filter((id):id is string=>!!id))];
  const bySnapshot=new Map<string,ListingPhoto[]>();
  // Batch by snapshot and page past PostgREST's row limit; avoid one query per card.
  if(snapshots.length)for(let start=0;;start+=1000) {
    const photos=await checked(reviewDatabase().from('snapshot_photos').select('snapshot_id,source_url,status,position')
      .in('snapshot_id',snapshots).order('snapshot_id').order('position').range(start,start+999));
    for(const photo of photos ?? []) {
      const group=bySnapshot.get(photo.snapshot_id) ?? [];
      group.push({source_url:photo.source_url,status:photo.status});bySnapshot.set(photo.snapshot_id,group);
    }
    if(!photos || photos.length<1000)break;
  }
  return {...page,version,columns:Object.fromEntries(stages.map(stage=>[stage,{...page.columns[stage],cards:page.columns[stage].cards.map(card=>({
    ...projectStock(card),photos:availablePhotos(bySnapshot.get(card.stock_snapshot_id ?? '') ?? []),
  }))}])) as BoardPage['columns']};
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
export type CardDetail={card:BoardCard;view:DeliveryView|null;partNumber:ListingPartNumber|null;erpPurchases:ListingErpPurchase[];
  snapshot:{id:string;observed_at:string;source:string;normalized_payload:Record<string,unknown>;raw_payload:Record<string,unknown>|null}|null;
  photos:{source_url:string;status:string;content_hash:string|null}[];search:Record<string,unknown>;captured:CapturedListingView;description:SafeDescription};
export async function readCard(board:Board,id:string):Promise<CardDetail|null>{
  // A single DB statement keeps every section at the same revision and avoids
  // two network round trips plus rebuilding the board projection for the view.
  const stored=await checked(reviewDatabase().rpc('review_card_detail',{p_board:board,p_id:id})) as
    (Omit<CardDetail,'card'|'captured'|'description'> & {card:StoredCard})|null;
  if(!stored)return null;
  const card=projectStock(stored.card),search=stored.search ?? {};
  const captured=capturedListingView({snapshot:stored.snapshot,search,photoCount:stored.photos.length,conditionId:card.condition_id});
  return {...stored,card,search,captured:{...captured,descriptionSource:null},description:sanitizeDescription(captured.descriptionSource)};
}
