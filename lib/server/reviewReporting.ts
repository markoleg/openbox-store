import 'server-only';
import {reviewDatabase} from './reviewCommands';
import type {BoardFilters,Cursor} from '@/lib/reviewBoards';
import type {ExportManifest,ExportPage,ReactionPage,Statistics} from '@/lib/reviewReporting';

async function rpc<T>(name:string,args:Record<string,unknown>):Promise<T> {
  const {data,error}=await reviewDatabase().rpc(name,args);
  if(error)throw Object.assign(new Error('report_storage_failed'),{code:error.code});
  return data as T;
}
export const readStatistics=(filters:BoardFilters,threshold:number|null)=>rpc<Statistics>('review_statistics',{p_filters:filters,p_threshold_seconds:threshold});
export const readReactions=(link:string,cursor?:Cursor)=>rpc<ReactionPage>('review_reaction_history',{p_link:link,p_before:cursor?.at ?? null,p_before_id:cursor?.id ?? null,p_limit:50});
export const createExport=(id:string,filters:BoardFilters)=>rpc<ExportManifest>('create_review_export',{p_id:id,p_filters:filters});
export const readExport=(id:string,after:number)=>rpc<ExportPage>('review_export_page',{p_id:id,p_after:after,p_limit:25});
