import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dispatchIdFromToken, normalizeListingLink, parseReviewCommand, parseReviewContext, parseSearchSave, tokenFromDispatchId} from '../lib/reviewCommands.ts';
const uuid='11111111-1111-4111-8111-111111111111';
const command=(action,payload={})=>({commandId:uuid,contextId:uuid,action,payload});
test('commands are explicit and retain a stable request id',()=>{
  assert.equal(parseReviewCommand(command('pause',{days:3})).commandId,uuid);
  assert.equal(parseReviewCommand(command('set_like',{value:false})).payload.value,false);
});
test('sniper ACK and arbitrary actor/time/SQL fields are rejected',()=>{
  assert.throws(()=>parseReviewCommand(command('ack')));
  assert.throws(()=>parseReviewCommand({...command('hide'),actor:'buyer'}));
  assert.throws(()=>parseReviewCommand(command('hide',{received_at:'yesterday'})));
});
test('manual outcomes cannot masquerade as live hide/ban/pause',()=>{
  for(const value of ['hidden','paused','banned','unknown']) assert.throws(()=>parseReviewCommand(command('set_outcome',{value})));
  for(const value of ['bought','would_buy_missed','would_hide','bug']) assert.equal(parseReviewCommand(command('set_outcome',{value})).payload.value,value);
});
test('pause durations, booleans and required correction reasons are validated',()=>{
  for(const days of [0,2,3.5,'3',null]) assert.throws(()=>parseReviewCommand(command('pause',{days})));
  assert.throws(()=>parseReviewCommand(command('set_like',{value:'false'})));
  assert.throws(()=>parseReviewCommand(command('clear_outcome',{reason:'  '})));
  assert.throws(()=>parseReviewCommand(command('extend_pause',{days:3})));
  assert.equal(parseReviewCommand(command('clear_outcome',{reason:'Помилився'})).action,'clear_outcome');
});
test('contexts cannot mix listing, event and delivery identities',()=>{
  assert.equal(parseReviewContext({kind:'delivery',target:uuid}).target,uuid);
  assert.throws(()=>parseReviewContext({kind:'delivery',target:'https://www.ebay.com/itm/123'}));
  assert.throws(()=>parseReviewContext({kind:'listing',target:'https://www.ebay.com.evil.test/itm/123'}));
  assert.throws(()=>parseReviewContext({kind:'listing',target:'https://www.ebay.com/itm/123?var=1'}));
  assert.equal(parseReviewContext({kind:'listing',target:'https://www.ebay.com/itm/123'}).kind,'listing');
});
test('watch payloads are explicit rules: favorite true, positive target, note optional',()=>{
  assert.equal(parseReviewCommand(command('set_watch',{favorite:true,desired_price:120,description:'n'})).action,'set_watch');
  assert.throws(()=>parseReviewCommand(command('set_watch',{favorite:false,desired_price:120})));
  assert.throws(()=>parseReviewCommand(command('set_watch',{favorite:true,desired_price:0})));
  assert.throws(()=>parseReviewCommand(command('set_watch',{favorite:true,desired_price:10,note:'wrong key'})));
  assert.throws(()=>parseReviewCommand(command('set_watch',{favorite:true,desired_price:10,super_favorite:'yes'})));
  assert.equal(parseReviewCommand(command('remove_watch')).action,'remove_watch');
  assert.throws(()=>parseReviewCommand({...command('hide'),source:'telegram'}));
  assert.equal(parseReviewCommand({...command('hide'),source:'dashboard_toast'}).source,'dashboard_toast');
});
test('contexts accept an explicit search scope and registration only for listings',()=>{
  assert.equal(parseReviewContext({kind:'listing',target:'https://www.ebay.com/itm/123',searchId:4,register:true}).searchId,4);
  assert.throws(()=>parseReviewContext({kind:'event',target:uuid,searchId:4}));
  assert.throws(()=>parseReviewContext({kind:'listing',target:'https://www.ebay.com/itm/123',register:'yes'}));
  assert.equal(parseReviewContext({kind:'dispatch',target:uuid.replace(/-/g,'')}).kind,'dispatch');
  assert.throws(()=>parseReviewContext({kind:'dispatch',target:'nope'}));
});
test('dispatch tokens round-trip and listing links normalise to /itm/<id>',()=>{
  assert.equal(dispatchIdFromToken(tokenFromDispatchId(uuid)),uuid.toLowerCase());
  assert.equal(dispatchIdFromToken('zz'),null);
  assert.equal(normalizeListingLink(' https://www.ebay.com/itm/Some-Title/123?var=1#x '),'https://www.ebay.com/itm/123');
  assert.equal(normalizeListingLink('https://evil.test/itm/1'),null);
});
test('search saves carry deltas, never a whole banned array',()=>{
  const ok=parseSearchSave({commandId:uuid,searchId:1,expectedVersion:3,config:{keywords:'x',filters:{}},ban:['https://www.ebay.com/itm/1'],unban:[]});
  assert.deepEqual(ok.ban,['https://www.ebay.com/itm/1']);
  assert.throws(()=>parseSearchSave({commandId:uuid,searchId:1,expectedVersion:3,config:{banned:[]},ban:[],unban:[]}));
  assert.throws(()=>parseSearchSave({commandId:uuid,searchId:1,expectedVersion:3,config:{},ban:['ftp://x'],unban:[]}));
  assert.throws(()=>parseSearchSave({commandId:uuid,searchId:1,expectedVersion:3,config:{filters:[]},ban:[],unban:[]}));
});
