import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseBoardQuery,tabFilters,searchLabel,parsePartNumberRequest,partNumberBadge,erpPurchaseBadge} from '../lib/reviewBoards.ts';
import {estimatedQuantity,stockLabel,projectStock} from '../lib/reviewStock.ts';
const id='11111111-1111-4111-8111-111111111111';
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


test('one queue has only new and processed cursors',()=>{
  assert.equal(parseBoardQuery(new URLSearchParams()).board,'notifications');
  const parsed=parseBoardQuery(new URLSearchParams({stage:'processed',processedAt:'2026-10-01T10:00:00Z',processedId:id}));
  assert.equal(parsed.filters.stage,'processed');assert.equal(parsed.cursors.processed.id,id);
  for(const text of ['tab=review','stage=working','stage=done','outcome=would_hide','partNumber=invalid','newId='+id,'from=yesterday','search=1,or(id.gt.0)'])assert.throws(()=>parseBoardQuery(new URLSearchParams(text)));
  assert.equal(tabFilters(new URLSearchParams({'notifications.link':'abc',card:id}),'notifications').toString(),'tab=notifications&link=abc');
});
test('ERP badge distinguishes unknown quantity from zero',()=>{
  assert.equal(erpPurchaseBadge({erp_purchases:0}),null);
  assert.equal(erpPurchaseBadge({erp_purchases:2,erp_units:3,erp_unknown_quantities:1}),'ERP · 2 закуп. · 3 шт + невідома кількість');
});
