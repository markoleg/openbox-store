import {test} from 'node:test';
import assert from 'node:assert/strict';
import {callback, describeResult, outcomeLabel, parseReviewCallback, renderKeyboard, urlButtons} from '../lib/reviewKeyboard.ts';

const dispatch='0f1e2d3c-4b5a-4978-8877-665544332211';
const token=dispatch.replace(/-/g,'');
test('manual purchased label is explicit even with an unknown ERP draft',()=>{
  assert.equal(outcomeLabel({outcome:'bought',outcomeSource:'manual',manualPurchaseQuantity:2,erpDrafts:1}),'✅ Купив · вручну · 2 шт.');
});
const urls=[{text:'🎯 Sniper',url:'https://d.example/sniper?link=x&ctx='+token},{text:'💳 Баланси',url:'https://crm.example/purchase-funding?amountUsd=1'},
  {text:'📝 Картка та історія',url:'https://d.example/zhezhemon/history?dispatch='+token}];
const view=(extra={})=>({deliveryId:'d1',eventId:'e1',dispatchId:dispatch,link:'https://www.ebay.com/itm/1',channel:'main',kind:'first_seen',
  botId:1,chatId:2,messageId:3,sentAt:'2026-09-11T10:00:00Z',stateVersion:0,resolutionKind:null,searchId:1,searchExists:true,searchName:'iphone 15',
  outcome:null,outcomeReason:null,outcomeNote:null,outcomeAt:null,outcomeSource:null,contextPrice:'100',currentPrice:100,title:'t',
  live:{hidden:false,hiddenUntil:null,hidePrice:null,favorite:false,superFavorite:false,desiredPrice:null,bannedInSearch:false,stockBlocked:false,liked:false,listingVersion:0},
  stage:'new',legacyOutcome:null,...extra});
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

test('main keyboard keeps the requested two rows and per-message URLs, including old layouts',()=>{
  const keyboard=renderKeyboard(view(),urls),codes=callbacks(keyboard).map(s=>parseReviewCallback(s).code);
  assert.deepEqual(codes,['hide','pausem','ban','missed','funds']);
  assert.deepEqual(texts(keyboard),[['🙈 Hide','⏸ Пауза','🚫 Ban','🎯'],['⏱ Не встиг','💰 Кошти','💳','📝']]);
  assert.equal(keyboard.inline_keyboard[0][3].url,urls[0].url);
  assert.deepEqual(keyboard.inline_keyboard[1].slice(2).map(b=>b.url),urls.slice(1).map(b=>b.url));
  const legacyBug={text:'🐞 Баг…',url:urls[2].url+'&action=bug'};
  assert.deepEqual(renderKeyboard(view(),[legacyBug,...urls]),keyboard);
  assert.deepEqual(renderKeyboard(view(),urlButtons(keyboard)),keyboard);
});

test('unconfigured balances are omitted; editing a result keeps the same action layout',()=>{
  const keyboard=renderKeyboard(view(),urls.filter(b=>!b.url.includes('/purchase-funding')));
  assert.deepEqual(texts(keyboard)[1],['⏱ Не встиг','💰 Кошти','📝']);
  const editing=renderKeyboard(view({stage:'processed',outcome:'funds'}),urls,'change');
  assert.deepEqual(texts(editing).slice(1),texts(renderKeyboard(view(),urls)));
});
test('processed card keeps ERP result and editing, super call-off remains independent',()=>{
  const result=view({stage:'processed',outcome:'bought',resolutionKind:'erp_purchase',live:{...view().live,superFavorite:true}});
  const keyboard=renderKeyboard(result,urls);
  assert.equal(outcomeLabel(result),'✅ Купив · ERP');
  assert.ok(keyboard.inline_keyboard.flat().some(b=>b.callback_data==='ack'));
  assert.ok(callbacks(keyboard).some(s=>s.endsWith(':chgm')));
  assert.ok(!callbacks(keyboard).some(s=>s.endsWith(':bought')));
  assert.equal(parseReviewCallback('ack'),null);
});
test('pause offers supported days and retired callbacks remain parsable for safe rejection',()=>{
  assert.deepEqual(callbacks(renderKeyboard(view(),urls,'pause')).filter(s=>s.includes(':pause:')).map(s=>parseReviewCallback(s).arg),['1','3','5','7']);
  for(const code of ['ack','bought','whide'])assert.equal(parseReviewCallback(`rv:${token}:${code}`).code,code);
  assert.match(describeResult('hide',{status:'conflict',reason:'price_changed',currentPrice:90,contextPrice:100}),/Ціна змінилась/);
});
