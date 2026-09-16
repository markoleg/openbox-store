/** Pure display model for a historical listing snapshot. Tolerant of any payload shape; never invents data. */
import { estimatedQuantity, type StockQuantity } from './reviewStock.ts';

export type Money = {amount:string; currency:string | null};
export type SellerFacts = {name:string | null; positivePercent:number | null; feedbackCount:number | null};
export type Aspect = {name:string; values:string[]; identifier:boolean};
export type AvailabilityStatus = 'in_stock' | 'limited' | 'out_of_stock' | 'unverified';
export type Availability = {status:AvailabilityStatus; quantity:StockQuantity | null; conflicting:boolean};
export type PriceBreakdown = {
  item:Money | null; shipping:Money | null; total:Money | null; shippingFromSearch:boolean;
  corridor:{min:number | null; max:number | null};
};
export type DescriptionSource = {kind:'html' | 'text'; value:string} | null;
export type CapturedSection = 'shop' | 'aspects' | 'description' | 'photos' | 'price_shipping';
export type CapturedListingView = {
  provenance:{sourceCode:string | null; sourceLabel:string; observedAt:string | null; detailed:boolean; fallbackNote:string | null};
  condition:{id:string | null; label:string | null};
  seller:SellerFacts | null;
  aspects:Aspect[];
  availability:Availability;
  price:PriceBreakdown;
  descriptionSource:DescriptionSource;
  photoCount:number;
  missing:CapturedSection[];
};

type Dict = Record<string,unknown>;
const object=(v:unknown):v is Dict=>!!v && typeof v==='object' && !Array.isArray(v);
const text=(v:unknown):string | null=>typeof v==='string' && v.trim() ? v.trim() : null;
const finite=(v:unknown):number | null=>{
  if(typeof v==='number')return Number.isFinite(v) ? v : null;
  if(typeof v==='string' && /^\s*-?\d+(\.\d+)?\s*$/.test(v))return Number(v);
  return null;
};
const decimal=(v:unknown):string | null=>{
  if(typeof v==='number' && Number.isFinite(v) && v>=0)return String(v);
  if(typeof v==='string' && /^\d+(\.\d+)?$/.test(v.trim()))return v.trim();
  return null;
};

const sourceLabels:Record<string,string>={get_item:'детальні дані eBay',search:'дані пошуку eBay',ui_context:'збережений контекст'};
export function sourceLabel(code:unknown):string {
  return (typeof code==='string' && sourceLabels[code]) || 'збережений знімок';
}

const conditionNames:Record<string,string>={'1000':'New','1500':'New other','2000':'Certified refurbished','2500':'Seller refurbished','3000':'Used'};
export function conditionLabel(raw:Dict,normalized:Dict,fallbackId:unknown):{id:string | null; label:string | null} {
  const id=text(normalized.conditionId) ?? text(raw.conditionId) ?? text(fallbackId);
  const name=text(normalized.condition) ?? text(raw.condition) ?? (id ? conditionNames[id] ?? null : null);
  if(!id && !name)return {id:null,label:null};
  return {id,label:name && id ? `${name} (${id})` : name ?? id};
}

export function sellerFacts(raw:Dict,normalized:Dict):SellerFacts | null {
  const seller=object(raw.seller) ? raw.seller : {};
  const name=text(seller.username) ?? text(normalized.seller_name);
  const percent=finite(seller.feedbackPercentage ?? normalized.feedback_percentage);
  const count=finite(seller.feedbackScore ?? normalized.feedback_score);
  if(!name && percent===null && count===null)return null;
  return {
    name,
    positivePercent:percent!==null && percent>=0 && percent<=100 ? percent : null,
    feedbackCount:count!==null && count>=0 && Number.isInteger(count) ? count : null,
  };
}

const identifierNames=/^(upc|mpn|ean|isbn|gtin|sku|model number|part number|manufacturer part number)$/i;
function aspectValues(value:unknown):string[] {
  const list=Array.isArray(value) ? value : [value];
  return list.flatMap(v=>{
    if(typeof v==='string')return text(v) ? [v.trim()] : [];
    if(typeof v==='number' || typeof v==='boolean')return [String(v)];
    return [];
  });
}
export function aspectList(raw:Dict):Aspect[] {
  if(!Array.isArray(raw.localizedAspects))return [];
  const rows:Aspect[]=[];
  for(const entry of raw.localizedAspects) {
    if(!object(entry))continue;
    const name=text(entry.name), values=aspectValues(entry.value);
    if(!name || !values.length)continue;
    rows.push({name,values,identifier:identifierNames.test(name)});
  }
  // Identifiers are useful for matching but not the first thing to read.
  return [...rows.filter(r=>!r.identifier),...rows.filter(r=>r.identifier)];
}

/** Same gate as the tile projection (projectStock) plus an explicit status. */
export function availabilityFact(evidence:unknown):Availability {
  const entries=Array.isArray(evidence) ? evidence : [];
  const statuses=new Set(entries.map(e=>object(e) ? String(e.estimatedAvailabilityStatus ?? '') : ''));
  const known=['IN_STOCK','LIMITED_STOCK','OUT_OF_STOCK'];
  if(!entries.length || !entries.every(object) || [...statuses].some(s=>!known.includes(s)))return {status:'unverified',quantity:null,conflicting:false};
  if(statuses.has('OUT_OF_STOCK'))return statuses.size===1 ? {status:'out_of_stock',quantity:null,conflicting:false} : {status:'unverified',quantity:null,conflicting:true};
  const quantity=estimatedQuantity(entries);
  const conflicting=quantity===null && entries.some(e=>{
    const d=e as Dict, a=d.estimatedAvailableQuantity, r=d.estimatedRemainingQuantity;
    return a!=null && r!=null && a!==r;
  });
  return {status:statuses.has('LIMITED_STOCK') ? 'limited' : 'in_stock',quantity,conflicting};
}

export function priceBreakdown(normalized:Dict,search:Dict):PriceBreakdown {
  const currency=text(normalized.currency);
  const item=decimal(normalized.price), shipping=decimal(normalized.shipping_cost), total=decimal(normalized.total_price);
  const shippingCurrency=text(normalized.shipping_currency) ?? currency;
  const sameCurrency=!shipping || !currency || !shippingCurrency || shippingCurrency===currency;
  return {
    item:item ? {amount:item,currency} : null,
    shipping:shipping ? {amount:shipping,currency:shippingCurrency} : null,
    // A total across two currencies would be an invented conversion.
    total:total && sameCurrency ? {amount:total,currency} : null,
    shippingFromSearch:normalized.shipping_source==='search_fallback',
    corridor:{min:finite(search.minprice),max:finite(search.maxprice)},
  };
}

export function descriptionSource(raw:Dict,normalized:Dict):DescriptionSource {
  const full=text(raw.description);
  if(full)return {kind:/<\/?[a-z][\s\S]*>/i.test(full) ? 'html' : 'text',value:full};
  const short=text(raw.shortDescription) ?? text(normalized.shortDescription);
  return short ? {kind:'text',value:short} : null;
}

export function capturedListingView(input:{
  snapshot:{source:unknown; observed_at:unknown; normalized_payload:unknown; raw_payload:unknown} | null;
  search:unknown; photoCount:number; conditionId?:unknown;
}):CapturedListingView {
  const raw=object(input.snapshot?.raw_payload) ? input.snapshot.raw_payload : {};
  const normalized=object(input.snapshot?.normalized_payload) ? input.snapshot.normalized_payload : {};
  const search=object(input.search) ? input.search : {};
  const sourceCode=text(input.snapshot?.source);
  const seller=sellerFacts(raw,normalized), aspects=aspectList(raw), description=descriptionSource(raw,normalized);
  const price=priceBreakdown(normalized,search);
  const missing:CapturedSection[]=[];
  if(!seller)missing.push('shop');
  if(!aspects.length)missing.push('aspects');
  if(!description)missing.push('description');
  if(!input.photoCount)missing.push('photos');
  if(!price.item)missing.push('price_shipping');
  const detailed=sourceCode==='get_item' && object(input.snapshot?.raw_payload);
  let fallbackNote:string | null=null;
  if(!input.snapshot)fallbackNote='Знімок для цього повідомлення не зберігся; дані оголошення недоступні.';
  else if(!detailed && missing.length)fallbackNote='У цьому знімку доступні лише дані пошуку; деталі eBay не були зафіксовані до відправлення.';
  return {
    provenance:{sourceCode,sourceLabel:sourceLabel(sourceCode),observedAt:text(input.snapshot?.observed_at),detailed,fallbackNote},
    condition:conditionLabel(raw,normalized,input.conditionId),
    seller,aspects,
    availability:availabilityFact(normalized.estimatedAvailabilities ?? raw.estimatedAvailabilities),
    price,descriptionSource:description,photoCount:input.photoCount,missing,
  };
}

// ---- formatting (locale-aware, no string concatenation of money) ----
const uk=new Intl.NumberFormat('uk-UA',{maximumFractionDigits:1});
export const formatCount=(n:number)=>new Intl.NumberFormat('uk-UA').format(n);
export const formatPercent=(n:number)=>`${uk.format(n)}%`;
export function formatMoney(money:Money | null):string | null {
  if(!money)return null;
  const value=Number(money.amount);
  if(!Number.isFinite(value))return null;
  if(money.currency && /^[A-Z]{3}$/.test(money.currency)) {
    try { return new Intl.NumberFormat('en-US',{style:'currency',currency:money.currency}).format(value); } catch { /* unknown ISO code */ }
  }
  return `${money.amount}${money.currency ? ' '+money.currency : ''}`;
}
export function sellerLine(seller:SellerFacts):string {
  return [seller.name,seller.positivePercent!==null ? `${formatPercent(seller.positivePercent)} позитивних` : null,
    seller.feedbackCount!==null ? `${formatCount(seller.feedbackCount)} оцінок` : null].filter(Boolean).join(' · ');
}
export function availabilityLabel(a:Availability):string {
  const qty=a.quantity ? (a.quantity.relation==='more_than' ? `понад ${a.quantity.value} шт.` : `≈${a.quantity.value} шт.`) : null;
  switch(a.status) {
    case 'in_stock': return qty ? `В наявності · ${qty}` : 'В наявності · кількість не вказана';
    case 'limited': return qty ? `Малий залишок · ${qty}` : 'Малий залишок · кількість не вказана';
    case 'out_of_stock': return 'Немає в наявності';
    default: return 'Наявність не підтверджена';
  }
}
export function corridorLabel(c:{min:number | null; max:number | null},currency:string | null):string | null {
  const fmt=(n:number)=>formatMoney({amount:String(n),currency}) ?? String(n);
  if(c.min!==null && c.max!==null)return `${fmt(c.min)}–${fmt(c.max)}`;
  if(c.min!==null)return `від ${fmt(c.min)}`;
  if(c.max!==null)return `до ${fmt(c.max)}`;
  return null;
}
export const sectionLabels:Record<CapturedSection,string>={shop:'магазин',aspects:'параметри',description:'опис',photos:'фото',price_shipping:'ціна'};
