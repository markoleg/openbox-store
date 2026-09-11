import {test} from 'node:test';
import assert from 'node:assert/strict';
import {callback, describeResult, outcomeLabel, parseReviewCallback, renderKeyboard, urlButtons} from '../lib/reviewKeyboard.ts';

const dispatch='0f1e2d3c-4b5a-4978-8877-665544332211';
const token=dispatch.replace(/-/g,'');
const urls=[{text:'🎯 Sniper',url:'https://d.example/sniper?link=x&ctx='+token},{text:'💳 Баланси',url:'https://crm.example/purchase-funding?amountUsd=1'},
  {text:'📝 Картка та історія',url:'https://d.example/zhezhemon/history?dispatch='+token}];
const view=(extra={})=>({deliveryId:'d1',eventId:'e1',dispatchId:dispatch,link:'https://www.ebay.com/itm/1',channel:'main',kind:'first_seen',
  botId:1,chatId:2,messageId:3,sentAt:'2026-09-11T10:00:00Z',stateVersion:0,resolutionKind:null,searchId:1,searchExists:true,searchName:'iphone 15',
  firstReactionAt:null,outcome:null,outcomeReason:null,outcomeNote:null,outcomeAt:null,outcomeSource:null,contextPrice:'100',currentPrice:100,title:'t',
  live:{hidden:false,hiddenUntil:null,hidePrice:null,favorite:false,superFavorite:false,desiredPrice:null,bannedInSearch:false,stockBlocked:false,liked:false,listingVersion:0},
  review:null,...extra});
const texts=m=>m.inline_keyboard.map(r=>r.map(b=>b.text));
const callbacks=m=>m.inline_keyboard.flat().filter(b=>b.callback_data).map(b=>b.callback_data);

test('callbacks carry the dispatch token, fit 64 bytes and parse back',()=>{
  for(const data of callbacks(renderKeyboard(view(),urls))) {
    assert.ok(new TextEncoder().encode(data).length<=64,data);
    assert.equal(parseReviewCallback(data).dispatchId,dispatch);
  }
  assert.equal(parseReviewCallback('rv:'+token+':pause:7').arg,'7');
  assert.equal(parseReviewCallback('rv:'+token+':evil'),null);
  assert.equal(parseReviewCallback('zh:123'),null);
  assert.equal(parseReviewCallback('rv:'+token+':missed:DROP TABLE'),null);
  assert.throws(()=>callback(token,'missed','x'.repeat(40)));
});
test('fresh layout matches the tracker initial keyboard and keeps URL buttons',()=>{
  const m=renderKeyboard(view(),urls);
  assert.deepEqual(texts(m),[['🖐 Опрацьовую','✅ Купив'],['🙈 Hide','⏸ Пауза…','🚫 Ban'],['Не встиг','Ще…'],['🎯 Sniper','💳 Баланси'],['📝 Картка та історія']]);
  assert.equal(m.inline_keyboard[3][1].url,urls[1].url);
});
test('after attention the first button reads "в роботі" but every decision stays',()=>{
  const m=renderKeyboard(view({firstReactionAt:'2026-09-11T10:01:00Z'}),urls);
  assert.equal(m.inline_keyboard[0][0].text,'🖐 В роботі');
  assert.ok(callbacks(m).some(c=>c.endsWith(':hide')));
});
test('after an outcome the message shows it with correction, more, sniper, balances and evaluation access',()=>{
  const m=renderKeyboard(view({outcome:'banned',resolutionKind:'direct',review:{id:'r',submittedAt:null,revisionOpenedAt:null,originDeliveryId:'d1'}}),urls);
  assert.equal(m.inline_keyboard[0][0].text,'🚫 Забанено в «iphone 15»');
  assert.deepEqual(texts(m).slice(1),[['✏️ Змінити результат','Ще…'],['🎯 Sniper','💳 Баланси'],['📝 Оцінити']]);
  assert.equal(outcomeLabel(view({outcome:'bought',resolutionKind:'event_context'})),'✅ Купив · з дашборда');
  assert.equal(renderKeyboard(view({outcome:'bought',review:{id:'r',submittedAt:'2026-09-11T11:00:00Z',revisionOpenedAt:null,originDeliveryId:'d1'}}),urls)
    .inline_keyboard.at(-1)[0].text,'📝 Переглянути оцінку');
});
test('menus only navigate and offer live undo when the state exists',()=>{
  assert.deepEqual(texts(renderKeyboard(view(),urls,'pause')),[['⏸ 1д','⏸ 3д','⏸ 5д','⏸ 7д'],['⬅️ Назад']]);
  const more=renderKeyboard(view({live:{...view().live,hidden:true,bannedInSearch:true}}),urls,'more');
  assert.ok(texts(more).flat().includes('👁 Показати знову') && texts(more).flat().includes('♻️ Зняти бан'));
  assert.ok(!texts(renderKeyboard(view(),urls,'more')).flat().includes('👁 Показати знову'));
  const missed=renderKeyboard(view(),urls,'missed');
  assert.equal(missed.inline_keyboard[1][1].url,urls[2].url+'&action=missed');
  const change=renderKeyboard(view({outcome:'bought'}),urls,'change');
  assert.ok(change.inline_keyboard.flat().some(b=>b.url?.endsWith('action=clear')));
});
test('conflicts and rejections are never described as success',()=>{
  assert.match(describeResult('hide',{status:'conflict',reason:'price_changed',contextPrice:200,currentPrice:180}),/200.*180/);
  assert.equal(describeResult('review_ack',{status:'noop'}),'Уже в роботі');
  assert.equal(describeResult('ban',{status:'rejected',reason:'x'}),'Не виконано');
});
test('url buttons are read from a stored keyboard only',()=>{
  assert.equal(urlButtons({inline_keyboard:[[{text:'a',callback_data:'x'},{text:'b',url:'https://u'}]]}).length,1);
  assert.equal(urlButtons(null).length,0);
});
