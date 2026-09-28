import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseAssessment,parseBoardQuery,tabFilters,isSubmitted,reactionDelay,historyBoardDestination,searchLabel,parsePartNumberRequest,partNumberBadge} from '../lib/reviewBoards.ts';
import {estimatedQuantity,stockLabel,projectStock} from '../lib/reviewStock.ts';
const id='11111111-1111-4111-8111-111111111111';
const req=(payload={},action='draft')=>({commandId:id,reviewId:id,version:0,action,payload});

const stock=(extra={})=>({estimatedAvailabilityStatus:'IN_STOCK',deliveryOptions:['SHIP_TO_HOME'],...extra});
test('quantity follows backend field, threshold and delivery rules without inventing stock',()=>{
  const quantity=entries=>estimatedQuantity(entries);
  assert.deepEqual(quantity([stock({estimatedAvailableQuantity:3})]),{value:3,relation:'approx'});
  assert.deepEqual(quantity([stock({estimatedRemainingQuantity:4})]),{value:4,relation:'approx'});
  assert.deepEqual(quantity([stock({estimatedAvailableQuantity:99,availabilityThresholdType:'MORE_THAN',availabilityThreshold:10})]),{value:10,relation:'more_than'});
  const shipping=stock({estimatedAvailableQuantity:2});
  assert.deepEqual(quantity([shipping,shipping,stock({deliveryOptions:['IN_STORE_PICKUP'],estimatedAvailableQuantity:50})]),{value:2,relation:'approx'});
  assert.deepEqual(quantity([stock({deliveryOptions:[],estimatedAvailableQuantity:2})]),{value:2,relation:'approx'});
  for(const entries of [null,[],{},[null],[stock()],
    [shipping,stock({estimatedAvailableQuantity:3})],[shipping,stock()],
    [stock({deliveryOptions:['IN_STORE_PICKUP'],estimatedAvailableQuantity:2})],
    [stock({estimatedAvailableQuantity:2,estimatedRemainingQuantity:3})],
    [stock({estimatedAvailabilityStatus:'OUT_OF_STOCK',estimatedAvailableQuantity:2})],
    [stock({estimatedSoldQuantity:99})],
    [stock({availabilityThresholdType:'FUTURE',availabilityThreshold:10,estimatedAvailableQuantity:99})],
    [stock({deliveryOptions:'SHIP_TO_HOME',estimatedAvailableQuantity:2})],
    ...[0,-1,1.5,'2',true,Number.NaN].map(q=>[stock({estimatedAvailableQuantity:q})])])assert.equal(quantity(entries),null);
  assert.equal(stockLabel(null),'Кількість невідома');
  assert.equal(stockLabel({value:2,relation:'approx'}),'≈2 шт.');
  assert.equal(stockLabel({value:10,relation:'more_than'}),'понад 10 шт.');
});
test('compact stock projection preserves historical pointers and strips evidence without mutating input',()=>{
  const row={id,stock_snapshot_id:'snapshot',stock_observed_at:'2026-09-15T10:00:00Z',stock_evidence:[stock({estimatedAvailableQuantity:3})]};
  const before=structuredClone(row), result=projectStock(row);
  assert.deepEqual(row,before);
  assert.deepEqual(result,{id,stock_snapshot_id:row.stock_snapshot_id,stock_observed_at:row.stock_observed_at,stock_quantity:{value:3,relation:'approx'}});
  assert.equal('stock_evidence' in result,false);
  assert.equal(projectStock({stock_evidence:null}).stock_quantity,null);
  assert.equal(projectStock({stock_evidence:[stock({estimatedAvailableQuantity:3}),stock({deliveryOptions:['IN_STORE_PICKUP'],estimatedAvailabilityStatus:'OUT_OF_STOCK'})]}).stock_quantity,null);
});

test('missing search title never implies deletion; deleted search keeps historical label',()=>{
  assert.equal(searchLabel({search_id:1,search_name:null}),'Пошук #1');
  assert.equal(searchLabel({search_id:null,search_name:'Original'}),'Original (пошук видалено)');
  assert.equal(searchLabel({search_id:1,search_name:'Original'}),'Original');
});
test('assessment accepts partial draft, never actor or automatic submitted_at',()=>{
  assert.equal(parseAssessment(req({score_title:4,note_title:'Reason'})).payload.score_title,4);
  for(const payload of [{actor_id:'buyer'},{submitted_at:'now'},{score_title:6},{score_title:1.5},{score_title:'3'},{note_title:2}])assert.throws(()=>parseAssessment(req(payload)));
  assert.throws(()=>parseAssessment({...req(),version:-1}));
});
test('reopening needs explicit reason; photos and decisions have bounded shape',()=>{
  assert.throws(()=>parseAssessment(req({},'reopen')));
  assert.throws(()=>parseAssessment(req({reason:' '},'reopen')));
  assert.equal(parseAssessment(req({reason:'Correction'},'reopen')).action,'reopen');
  assert.throws(()=>parseAssessment(req({photo_notes:{image:123}})));
  assert.throws(()=>parseAssessment(req({decision_reaction_id:'latest'})));
});
test('filters and cursor contract rejects injected expressions and invalid dates',()=>{
  for(const text of ['tab=bad','search=1,or(id.gt.0)','from=yesterday','newAt=2026-09-11T00:00:00Z','newId='+id,'from=2026-09-12T00:00:00Z&to=2026-09-11T00:00:00Z'])assert.throws(()=>parseBoardQuery(new URLSearchParams(text)));
  const parsed=parseBoardQuery(new URLSearchParams({tab:'notifications',newAt:'2026-09-11T00:00:00Z',newId:id,withoutReview:'true'}));
  assert.equal(parsed.cursors.new.id,id);assert.equal(parsed.filters.withoutReview,true);
});
test('tabs keep independent URL filters without leaking selected cards',()=>{
  const p=new URLSearchParams({'review.link':'abc','notifications.channel':'sniper',tab:'review',review:id});
  assert.equal(tabFilters(p,'review').toString(),'tab=review&link=abc');
  assert.equal(tabFilters(p,'notifications').toString(),'tab=notifications&channel=sniper');
});
test('only explicit revision opens a submitted assessment again',()=>{
  const r={submitted_at:'2026-09-11T01:00:00Z',revision_opened_at:null};
  assert.equal(isSubmitted(r),true);
  assert.equal(isSubmitted({...r,revision_opened_at:'2026-09-11T01:00:01Z'}),false);
});
test('reaction delay never fabricates zero or negative SLA',()=>{
  const sent='2026-09-11T10:00:00Z';
  assert.equal(reactionDelay(sent,null),'немає прямої реакції');
  assert.equal(reactionDelay(sent,'2026-09-11T09:59:59Z'),'реакція до доставки');
  assert.equal(reactionDelay(sent,'2026-09-11T10:03:00Z'),'3 хв');
});
test('evaluation link opens origin review; repeats and explicit corrections retain their delivery',()=>{
  const d={deliveryId:id,review:{id:'review-id',originDeliveryId:id}};
  assert.match(historyBoardDestination(d),/tab=review&review=review-id/);
  assert.match(historyBoardDestination(d,'missed'),/tab=notifications.*action=missed/);
  assert.match(historyBoardDestination({...d,deliveryId:'repeat-id'}),/tab=notifications&delivery=repeat-id/);
});

test('part number filter accepts only the two board values',()=>{
  assert.equal(parseBoardQuery(new URLSearchParams('tab=notifications&partNumber=missing')).filters.partNumber,'missing');
  assert.equal(parseBoardQuery(new URLSearchParams('partNumber=not_in_catalog')).filters.partNumber,'not_in_catalog');
  assert.throws(()=>parseBoardQuery(new URLSearchParams('partNumber=identified')));
});

test('part number request is normalized like the RPC and never carries an actor',()=>{
  const body=(extra={})=>({commandId:id,link:'https://www.ebay.com/itm/123',partNumber:' mxp93ll/a ',version:3,...extra});
  assert.deepEqual(parsePartNumberRequest(body()),{commandId:id,link:'https://www.ebay.com/itm/123',partNumber:'MXP93LL/A',version:3});
  assert.equal(parsePartNumberRequest(body({partNumber:null,version:null})).partNumber,null);
  assert.equal(parsePartNumberRequest(body({partNumber:'   '})).partNumber,null);
  for(const bad of [body({partNumber:'M'}),body({partNumber:'MX P93'}),body({partNumber:'x'.repeat(65)}),body({partNumber:42}),
    body({version:0}),body({version:'3'}),body({link:'http://ebay.com/itm/1'}),body({commandId:'nope'}),body({actor:'someone'})])
    assert.throws(()=>parsePartNumberRequest(bad));
});

test('part number badge highlights exactly the cards a person must act on',()=>{
  const card=(extra={})=>({part_number:null,part_number_status:null,part_number_source:null,manual_part_number:null,part_number_version:null,...extra});
  assert.deepEqual(partNumberBadge(card()),{label:'Без партійного',tone:'missing'});
  assert.deepEqual(partNumberBadge(card({part_number_status:'unknown'})),{label:'Без партійного',tone:'missing'});
  assert.equal(partNumberBadge(card({part_number_status:'ambiguous'})).tone,'missing');
  assert.deepEqual(partNumberBadge(card({part_number:'MXP93LL/A',part_number_status:'unverified',part_number_source:'listing_mpn'})),{label:'MXP93LL/A? · не перевірено',tone:'missing'});
  assert.deepEqual(partNumberBadge(card({part_number:'MXP63',part_number_status:'identified',part_number_source:'purchase'})),{label:'MXP63',tone:'known'});
  assert.deepEqual(partNumberBadge(card({part_number:'MXED3',part_number_status:'not_in_catalog',part_number_source:'mpn'})),{label:'MXED3 · немає в ERP',tone:'catalog'});
  // A manual value waits for the next preflight before the CRM confirms it.
  assert.deepEqual(partNumberBadge(card({part_number_status:'unknown',manual_part_number:'MXP93'})),{label:'✍️ MXP93 · чекає ERP',tone:'pending'});
  assert.deepEqual(partNumberBadge(card({part_number:'MXP93',part_number_status:'identified',part_number_source:'manual',manual_part_number:'MXP93LL/A'})),{label:'✍️ MXP93',tone:'known'});
  assert.deepEqual(partNumberBadge(card({part_number:'MXED3',part_number_status:'not_in_catalog',part_number_source:'manual',manual_part_number:'MXED3'})),{label:'✍️ MXED3 · немає в ERP',tone:'catalog'});
});
