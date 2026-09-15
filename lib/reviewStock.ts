/** Keep this contract aligned with listing_data.estimated_quantity (backend). */
export type StockQuantity = {value:number; relation:'approx'|'more_than'};
const object=(value:unknown):value is Record<string,unknown>=>!!value && typeof value==='object' && !Array.isArray(value);
const positive=(value:unknown):value is number=>typeof value==='number' && Number.isSafeInteger(value) && value>0;

export function estimatedQuantity(entries:unknown):StockQuantity|null {
  if(!Array.isArray(entries) || !entries.length || !entries.every(object))return null;
  if(entries.some(e=>e.deliveryOptions!=null && (!Array.isArray(e.deliveryOptions) || !e.deliveryOptions.every((v:unknown)=>typeof v==='string'))))return null;
  const options=(entry:Record<string,unknown>)=>(entry.deliveryOptions??[]) as string[];
  const shipping=entries.filter(e=>options(e).includes('SHIP_TO_HOME'));
  const selected=shipping.length?shipping:entries.filter(e=>options(e).length===0);
  if(!selected.length)return null;
  const quantities:StockQuantity[]=[];
  for(const entry of selected) {
    if(!['IN_STOCK','LIMITED_STOCK'].includes(String(entry.estimatedAvailabilityStatus)))return null;
    if('availabilityThresholdType' in entry || 'availabilityThreshold' in entry) {
      if(entry.availabilityThresholdType!=='MORE_THAN' || !positive(entry.availabilityThreshold))return null;
      quantities.push({value:entry.availabilityThreshold,relation:'more_than'});
      continue;
    }
    const available=entry.estimatedAvailableQuantity, remaining=entry.estimatedRemainingQuantity;
    if([available,remaining].some(v=>v!=null && !positive(v)))return null;
    if(available!=null && remaining!=null && available!==remaining)return null;
    const value=available??remaining;
    if(!positive(value))return null;
    quantities.push({value,relation:'approx'});
  }
  return quantities.every(q=>q.value===quantities[0].value && q.relation===quantities[0].relation)?quantities[0]:null;
}

export function stockLabel(quantity:StockQuantity|null|undefined):string {
  if(!quantity)return 'Кількість невідома';
  return quantity.relation==='more_than'?`понад ${quantity.value} шт.`:`≈${quantity.value} шт.`;
}

/** Strip database-only evidence; the browser gets compact derived fields. */
export function projectStock<T extends {stock_evidence?:unknown}>(row:T):Omit<T,'stock_evidence'>&{stock_quantity:StockQuantity|null} {
  const {stock_evidence,...card}=row;
  // Match the sender's overall availability gate as well as quantity selection.
  // Mixed/unknown stock statuses must not look verified just on the dashboard.
  const verified=Array.isArray(stock_evidence) && stock_evidence.length>0 && stock_evidence.every(
    e=>object(e) && ['IN_STOCK','LIMITED_STOCK'].includes(String(e.estimatedAvailabilityStatus)));
  return {...card,stock_quantity:verified?estimatedQuantity(stock_evidence):null};
}
