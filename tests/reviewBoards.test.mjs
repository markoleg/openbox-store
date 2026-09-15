import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseAssessment,parseBoardQuery,tabFilters,isSubmitted,reactionDelay,historyBoardDestination,searchLabel} from '../lib/reviewBoards.ts';
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
