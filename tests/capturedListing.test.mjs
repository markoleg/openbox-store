import {test} from 'node:test';
import assert from 'node:assert/strict';
import {capturedListingView,availabilityFact,sellerFacts,aspectList,priceBreakdown,descriptionSource,conditionLabel,
  formatMoney,sellerLine,availabilityLabel,corridorLabel,sourceLabel} from '../lib/capturedListing.ts';
import {sanitizeDescription} from '../lib/sanitizeDescription.ts';

const stock=(extra={})=>({estimatedAvailabilityStatus:'IN_STOCK',deliveryOptions:['SHIP_TO_HOME'],...extra});
const fullRaw={
  seller:{username:'best_seller',feedbackScore:4695,feedbackPercentage:'99.9',sellerLegalInfo:{name:'Legal Corp'}},
  localizedAspects:[{name:'Brand',value:'Apple',type:'STRING'},{name:'UPC',value:'0194253'},{name:'Model',value:'Watch Series 10'},{name:'Weird',value:{nested:true}},{name:'',value:'x'},{name:'Colors',value:['Black','Blue']}],
  description:'<p>Hello <b>world</b></p><script>alert(1)</script>',
  estimatedAvailabilities:[stock({estimatedAvailableQuantity:2,estimatedRemainingQuantity:2})],
  condition:'New',conditionId:'1000',
};
const fullNormalized={price:'199.99',currency:'USD',shipping_cost:'0',shipping_currency:'USD',shipping_source:'response',total_price:'199.99',
  seller_name:'best_seller',feedback_score:4695,feedback_percentage:'99.9',conditionId:'1000',condition:'New',estimatedAvailabilities:fullRaw.estimatedAvailabilities};
const snapshot=(over={})=>({source:'get_item',observed_at:'2026-09-15T15:02:00Z',normalized_payload:fullNormalized,raw_payload:fullRaw,...over});

test('full getItem snapshot yields a complete readable projection without API keys',()=>{
  const view=capturedListingView({snapshot:snapshot(),search:{minprice:180,maxprice:230},photoCount:5});
  assert.deepEqual(view.missing,[]);
  assert.equal(view.provenance.detailed,true);assert.equal(view.provenance.fallbackNote,null);
  assert.equal(view.provenance.sourceLabel,'детальні дані eBay');
  assert.deepEqual(view.condition,{id:'1000',label:'New (1000)'});
  const line=sellerLine(view.seller);
  assert.match(line,/^best_seller · 99,9% позитивних · 4\s695 оцінок$/);
  assert.ok(!JSON.stringify(view.seller).includes('Legal'));
  assert.deepEqual(view.aspects.map(a=>a.name),['Brand','Model','Colors','UPC']);
  assert.deepEqual(view.aspects.find(a=>a.name==='Colors').values,['Black','Blue']);
  assert.equal(view.aspects.find(a=>a.name==='UPC').identifier,true);
  assert.deepEqual(view.availability,{status:'in_stock',quantity:{value:2,relation:'approx'},conflicting:false});
  assert.equal(availabilityLabel(view.availability),'В наявності · ≈2 шт.');
  assert.equal(formatMoney(view.price.total),'$199.99');
  assert.equal(corridorLabel(view.price.corridor,'USD'),'$180.00–$230.00');
  assert.deepEqual(view.descriptionSource,{kind:'html',value:fullRaw.description});
});

test('search fallback snapshot is honest about what was not captured',()=>{
  const view=capturedListingView({snapshot:snapshot({source:'search',raw_payload:null,normalized_payload:{price:'50',currency:'USD',shipping_cost:'5.5',shipping_source:'search_fallback',total_price:'55.5',shortDescription:'Short text'}}),search:{},photoCount:0,conditionId:'3000'});
  assert.equal(view.provenance.detailed,false);
  assert.match(view.provenance.fallbackNote,/лише дані пошуку/);
  assert.deepEqual(view.missing,['shop','aspects','photos']);
  assert.deepEqual(view.descriptionSource,{kind:'text',value:'Short text'});
  assert.equal(view.availability.status,'unverified');
  assert.equal(view.price.shippingFromSearch,true);
  assert.deepEqual(view.condition,{id:'3000',label:'Used (3000)'});
  assert.equal(corridorLabel(view.price.corridor,'USD'),null);
});

test('missing snapshot and unknown source degrade to neutral text',()=>{
  const view=capturedListingView({snapshot:null,search:null,photoCount:0});
  assert.match(view.provenance.fallbackNote,/не зберігся/);
  assert.equal(view.provenance.sourceLabel,'збережений знімок');
  assert.equal(sourceLabel('brand_new_source'),'збережений знімок');
  assert.equal(view.seller,null);assert.deepEqual(view.aspects,[]);assert.equal(view.descriptionSource,null);
  assert.deepEqual(view.missing,['shop','aspects','description','photos','price_shipping']);
});

test('seller facts tolerate malformed values and never invent zeros',()=>{
  assert.equal(sellerFacts({seller:'nope'},{}),null);
  assert.deepEqual(sellerFacts({seller:{username:' s ',feedbackScore:'12',feedbackPercentage:'abc'}},{}),{name:'s',positivePercent:null,feedbackCount:12});
  assert.deepEqual(sellerFacts({seller:{feedbackPercentage:0,feedbackScore:0}},{}),{name:null,positivePercent:0,feedbackCount:0});
  assert.deepEqual(sellerFacts({seller:{feedbackPercentage:120,feedbackScore:-1}},{seller_name:'n'}),{name:'n',positivePercent:null,feedbackCount:null});
  assert.equal(sellerLine({name:'only',positivePercent:null,feedbackCount:null}),'only');
});

test('aspects normalize arrays, drop objects and empty names, group identifiers last',()=>{
  assert.deepEqual(aspectList({localizedAspects:'x'}),[]);
  assert.deepEqual(aspectList({localizedAspects:[null,{name:'A',value:[1,{o:1},'b',' ']},{name:'MPN',value:'M1'},{name:'B',value:{}}]}),
    [{name:'A',values:['1','b'],identifier:false},{name:'MPN',values:['M1'],identifier:true}]);
});

test('availability truth table matches the tile gate and never uses sold quantity',()=>{
  const fact=(entries)=>availabilityFact(entries);
  assert.deepEqual(fact([stock({estimatedAvailableQuantity:3})]),{status:'in_stock',quantity:{value:3,relation:'approx'},conflicting:false});
  assert.deepEqual(fact([stock({estimatedAvailabilityStatus:'LIMITED_STOCK',estimatedRemainingQuantity:1})]),{status:'limited',quantity:{value:1,relation:'approx'},conflicting:false});
  assert.deepEqual(fact([stock({estimatedAvailabilityStatus:'OUT_OF_STOCK'})]),{status:'out_of_stock',quantity:null,conflicting:false});
  assert.deepEqual(fact([stock()]),{status:'in_stock',quantity:null,conflicting:false});
  assert.equal(availabilityLabel(fact([stock()])),'В наявності · кількість не вказана');
  assert.deepEqual(fact([stock({estimatedAvailableQuantity:2,estimatedRemainingQuantity:5})]),{status:'in_stock',quantity:null,conflicting:true});
  assert.deepEqual(fact([stock({estimatedAvailabilityStatus:'OUT_OF_STOCK'}),stock({estimatedAvailableQuantity:2})]),{status:'unverified',quantity:null,conflicting:true});
  assert.deepEqual(fact([stock({estimatedSoldQuantity:4695})]),{status:'in_stock',quantity:null,conflicting:false});
  assert.deepEqual(fact([stock({deliveryOptions:['IN_STORE_PICKUP'],estimatedAvailableQuantity:9})]),{status:'in_stock',quantity:null,conflicting:false});
  assert.deepEqual(fact([stock({estimatedAvailableQuantity:5}),stock({deliveryOptions:['IN_STORE_PICKUP'],estimatedAvailableQuantity:9})]).quantity,{value:5,relation:'approx'});
  assert.deepEqual(fact([stock({availabilityThresholdType:'MORE_THAN',availabilityThreshold:10})]).quantity,{value:10,relation:'more_than'});
  for(const entries of [undefined,null,[],{},[null],[{estimatedAvailabilityStatus:'MAYBE'}],[stock({estimatedAvailabilityStatus:undefined})]])
    assert.deepEqual(fact(entries),{status:'unverified',quantity:null,conflicting:false});
  assert.equal(availabilityLabel(fact(null)),'Наявність не підтверджена');
});

test('price breakdown formats money via Intl and refuses cross-currency totals',()=>{
  assert.equal(formatMoney({amount:'1234.5',currency:'USD'}),'$1,234.50');
  assert.equal(formatMoney({amount:'12',currency:'XYZ1'}),'12 XYZ1');
  assert.equal(formatMoney({amount:'12',currency:null}),'12');
  assert.equal(formatMoney({amount:'abc',currency:'USD'}),null);
  const mixed=priceBreakdown({price:'10',currency:'USD',shipping_cost:'2',shipping_currency:'EUR',total_price:'12'},{});
  assert.equal(mixed.total,null);assert.deepEqual(mixed.shipping,{amount:'2',currency:'EUR'});
  const partial=priceBreakdown({price:10,currency:'USD',shipping_cost:null,total_price:null},{minprice:'100',maxprice:null});
  assert.deepEqual(partial.item,{amount:'10',currency:'USD'});assert.equal(partial.shipping,null);
  assert.deepEqual(partial.corridor,{min:100,max:null});assert.equal(corridorLabel(partial.corridor,'USD'),'від $100.00');
  assert.equal(corridorLabel({min:null,max:30},null),'до 30');
  assert.equal(priceBreakdown({price:'-5'},{}).item,null);
});

test('description source prefers full description and detects html vs text',()=>{
  assert.deepEqual(descriptionSource({description:'plain words'},{}),{kind:'text',value:'plain words'});
  assert.deepEqual(descriptionSource({description:'<div>x</div>'},{}),{kind:'html',value:'<div>x</div>'});
  assert.deepEqual(descriptionSource({description:'   '},{shortDescription:'short'}),{kind:'text',value:'short'});
  assert.equal(descriptionSource({description:5},{}),null);
  assert.deepEqual(conditionLabel({},{},'1500'),{id:'1500',label:'New other (1500)'});
  assert.deepEqual(conditionLabel({},{},null),{id:null,label:null});
  assert.deepEqual(conditionLabel({condition:'Custom'},{},'9999'),{id:'9999',label:'Custom (9999)'});
});

test('hostile html is reduced to inert formatting; raw stays untouched elsewhere',()=>{
  const hostile='<script>window.bad=true</script><p onclick="x()" style="color:red" class="c" id="i" data-t="1">Hi <a href="javascript:alert(1)">bad</a> <a href="https://ok.example/x" target="_top" rel="x">ok</a> <a href="http://plain.example">http</a> <a href="  HTTPS://upper.example">up</a></p>'
    +'<img src="https://t.example/p.gif"><iframe src="https://x"></iframe><form><input><button>b</button></form><style>body{display:none}</style><svg onload="x()"><text>svg</text></svg><object data="x"></object><embed src="x"><link rel="stylesheet" href="x"><meta http-equiv="refresh" content="0">'
    +'<video src="https://v"></video><audio src="https://a"></audio><textarea>textarea-content</textarea><select><option>o</option></select><math><mi>m</mi></math>';
  const safe=sanitizeDescription({kind:'html',value:hostile});
  assert.equal(safe.kind,'html');
  for(const bad of ['<script','onclick','style','class=','id=','data-t','javascript:','<img','<iframe','<form','<input','<button','<svg','<object','<embed','<link','<meta','<video','<audio','<textarea','<select','<option','<math','textarea-content','svg','display:none','_top','rel="x"'])
    assert.ok(!safe.html.includes(bad),`must not contain ${bad}`);
  assert.ok(safe.html.includes('<a href="https://ok.example/x" target="_blank" rel="noopener noreferrer nofollow">ok</a>'));
  assert.ok(safe.html.includes('<a href="HTTPS://upper.example" target="_blank" rel="noopener noreferrer nofollow">up</a>'));
  assert.ok(safe.html.includes('<span>bad</span>') && safe.html.includes('<span>http</span>'));
  assert.ok(safe.html.startsWith('<p>Hi '));
});

test('full html documents keep body content only and plain text keeps paragraph breaks',()=>{
  const doc=sanitizeDescription({kind:'html',value:'<!DOCTYPE html><html><head><title>Ignored title</title><meta charset="utf-8"><style>p{}</style></head><body><h1>Big</h1><p>Body &amp; text<br>line</p><ul><li>one</li></ul><table><tr><td>c</td></tr></table></body></html>'});
  assert.equal(doc.html,'<h4>Big</h4><p>Body &amp; text<br />line</p><ul><li>one</li></ul><table><tr><td>c</td></tr></table>');
  assert.equal(doc.length,'Big Body & text line one c'.length);
  const text=sanitizeDescription({kind:'text',value:'  one  \r\n\r\n\r\n\r\ntwo <b>not html</b> '});
  assert.deepEqual(text,{kind:'text',text:'one\n\ntwo <b>not html</b>',length:24});
  assert.equal(sanitizeDescription({kind:'html',value:'<script>only</script><style>x</style>'}),null);
  assert.equal(sanitizeDescription({kind:'text',value:'   '}),null);
  assert.equal(sanitizeDescription(null),null);
});
