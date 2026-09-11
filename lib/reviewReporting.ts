/** Pure reporting/export contracts; never import database credentials here. */
export type ExportManifest = {id:string;created_at:string;expires_at:string;filters:Record<string,unknown>;row_count:number;excluded_count:number};
export type ExportRow = {schemaVersion:1;ordinal:number;assessment:Record<string,unknown>;features:Record<string,unknown>;decision:Record<string,unknown>};
export type ExportPage = {manifest:ExportManifest;after:number;complete:boolean;rows:ExportRow[]};
export type Statistics = {
  generatedAt:string;thresholdSeconds:number|null;
  summary:Record<string,number|null>;
  breakdown:{kind:string;condition_id:string|null;deliveries:number;direct_samples:number;median_seconds:number|null;p90_seconds:number|null}[];
  reasons:{outcome:string;reason_code:string|null;deliveries:number;triggers:number;links:number}[];
};
export type ReactionPage = {total:number;next:{at:string;id:string}|null;rows:{id:string;action:string;outcome:string|null;reason_code:string|null;note:string|null;source:string;actor_id:'buyer'|'system';received_at:string;delivery_id:string|null;event_id:string|null;supersedes_reaction_id:string|null}[]};
export function integerParameter(value:string|null,fallback:number,max:number):number {
  if(value===null)return fallback;
  if(!/^(0|[1-9][0-9]*)$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value)>max)throw new Error('invalid_number');
  return Number(value);
}
export function durationLabel(value:number|null|undefined):string {
  if(value==null || !Number.isFinite(value) || value<0)return '—';
  if(value<60)return `${Math.round(value)} с`;
  if(value<3600)return `${Math.round(value/60)} хв`;
  return `${(value/3600).toFixed(1)} год`;
}
/** Fail closed: a missing/duplicated page must never become a "complete" file. */
export function validateExportPage(manifest:ExportManifest,after:number,page:ExportPage):number {
  if(JSON.stringify(page.manifest)!==JSON.stringify(manifest) || !Number.isSafeInteger(manifest.row_count) || manifest.row_count<0 ||
    !Array.isArray(page.rows) || page.rows.some((r,i)=>r.schemaVersion!==1 || r.ordinal!==after+i+1) ||
    page.after!==after+page.rows.length || page.after>manifest.row_count ||
    page.complete!==(page.after===manifest.row_count) || (!page.complete && !page.rows.length))throw new Error('incomplete_export');
  return page.after;
}
