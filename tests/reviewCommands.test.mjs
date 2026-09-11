import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseReviewCommand, parseReviewContext} from '../lib/reviewCommands.ts';
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
