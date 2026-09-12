import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseAssessment,parseBoardQuery,tabFilters,isSubmitted,reactionDelay,historyBoardDestination,searchLabel} from '../lib/reviewBoards.ts';
const id='11111111-1111-4111-8111-111111111111';
const req=(payload={},action='draft')=>({commandId:id,reviewId:id,version:0,action,payload});

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
