import {test,expect} from '@playwright/test';
import {createHmac} from 'node:crypto';
import {capturedListingView} from '../../lib/capturedListing';
import {sanitizeDescription} from '../../lib/sanitizeDescription';

const id='11111111-1111-4111-8111-111111111111', delivery='22222222-2222-4222-8222-222222222222';
const link='https://www.ebay.com/itm/123', at='2026-09-11T08:00:00+00:00';
const card={id,board:'notifications',link,card_at:at,stage:'new',delivery_id:delivery,event_id:id,search_id:1,search_name:'Lenovo',kind:'first_seen',channel:'main',condition_id:'1000',title:'ThinkPad T14 — тестовий лот',price:'202.30',currency:'USD',outcome:null,outcome_at:null,resolution_kind:null,sent_at:at,hidden:false,hidden_until:null,favorite:false,stock_blocked:false,stock_snapshot_id:id,stock_observed_at:at,stock_quantity:{value:2,relation:'approx'},state_version:0,erp_purchases:0,erp_units:0,erp_unknown_quantities:0,listing_erp_purchases:0,listing_erp_units:0,erp_candidates:1,legacy_outcome:null,note:null};
const view={deliveryId:delivery,eventId:id,dispatchId:id,link,channel:'main',kind:'first_seen',sentAt:at,stateVersion:0,searchId:1,searchExists:true,searchName:'Lenovo',outcome:null,outcomeAt:null,resolutionKind:null,currentPrice:202.3,
  live:{hidden:false,hiddenUntil:null,hidePrice:null,favorite:false,bannedInSearch:false,stockBlocked:false,liked:false,listingVersion:0}};
const availability=[{estimatedAvailabilityStatus:'IN_STOCK',deliveryOptions:['SHIP_TO_HOME'],estimatedAvailableQuantity:2}];
const aspects=Array.from({length:10},(_,i)=>({name:`Параметр ${i+1}`,value:i?`значення ${i+1}`:'32 GB'}));
const hostileDescription='<script>window.bad=true</script><p style="color:red" onclick="window.bad=true">Текст продавця</p><img src="https://tracker.example/pixel.gif">'+'<p>Довгий абзац опису. </p>'.repeat(40);
const snapshot={id,observed_at:at,source:'get_item',normalized_payload:{title:card.title,price:'200.10',shipping_cost:'2.20',total_price:'202.30',currency:'USD',shipping_source:'response',itemWebUrl:link,estimatedAvailabilities:availability},
  raw_payload:{seller:{username:'seller',feedbackScore:4695,feedbackPercentage:'99.9'},localizedAspects:aspects,description:hostileDescription,estimatedAvailabilities:availability}};
const search={minprice:100,maxprice:500};
// Same server-side projection as readCard, so the UI fixture cannot drift from the real contract.
const captured=(photos:unknown[])=>{const view=capturedListingView({snapshot,search,photoCount:photos.length,conditionId:card.condition_id});return {captured:{...view,descriptionSource:null},description:sanitizeDescription(view.descriptionSource)};};
const detail={card,view,partNumber:null,erpPurchases:[],snapshot,photos:[],search,...captured([])};

test.beforeEach(async({context})=>{
  const now=Math.floor(Date.now()/1000), payload=Buffer.from(JSON.stringify({v:1,sub:'buyer',iat:now,exp:now+14*86400,nonce:'ui-test'})).toString('base64url');
  const signature=createHmac('sha256','local-stage-five-test-secret-not-for-production').update(payload).digest('base64url');
  await context.addCookies([{name:'review_test_session',value:`${payload}.${signature}`,domain:'127.0.0.1',path:'/',httpOnly:true,sameSite:'Strict'}]);
});

async function fixtures(page:any,photos:any[]=[],cardFields:Record<string,unknown>={}) {
  const commands:any[]=[];
  await page.addInitScript(()=>{
    class TestEventSource {
      static instances:TestEventSource[]=[]; listeners=new Map<string,Set<(event:Event)=>void>>();url:string;closed=false;onerror:null|(()=>void)=null;
      constructor(url:string){this.url=url;TestEventSource.instances.push(this);setTimeout(()=>this.emit('ready'),0)}
      addEventListener(name:string,listener:(event:Event)=>void){const values=this.listeners.get(name)??new Set();values.add(listener);this.listeners.set(name,values)}
      removeEventListener(name:string,listener:(event:Event)=>void){this.listeners.get(name)?.delete(listener)}
      emit(name:string){for(const listener of this.listeners.get(name)??[])listener(new Event(name))}
      close(){this.closed=true}
    }
    ;(window as any).EventSource=TestEventSource;(window as any).__reviewRealtime=TestEventSource.instances
  });
  await page.route('http://127.0.0.1:9/**',(route:any)=>route.fulfill({json:[]}));
  // Every poll sees a new change signal unless a test pins it.
  let signal=0;await page.route('**/api/review/boards/version',(route:any)=>route.fulfill({json:{version:++signal}}));
  await page.route('**/api/review/boards?**',async(route:any)=>{
    const url=new URL(route.request().url());
    if(url.searchParams.get('id')){await route.fulfill({json:{...detail,...captured(photos),photos}});return;}
    const stage=url.searchParams.get('stage') ?? 'new',rows=url.searchParams.get('link')==='none'?[]:Array.from({length:4},(_,i)=>({...card,...cardFields,photos,id:i===0?id:`33333333-3333-4333-8333-${String(i).padStart(12,'0')}`,title:`${cardFields.title ?? card.title} ${i+1}`,stage,...(stage==='processed'?{outcome:'funds'}:{})}));
    await route.fulfill({json:{pending:stage==='new'?rows.length:0,columns:{new:{count:stage==='new'?rows.length:0,cards:stage==='new'?rows:[]},processed:{count:stage==='processed'?rows.length:0,cards:stage==='processed'?rows:[]}}}});
  });
  await page.route('**/api/review/contexts',async(route:any)=>route.fulfill({json:{id,kind:'delivery',link,delivery_id:delivery,event_id:id,listing_version:0,result_version:0,snapshot_id:id,live:{listing_version:0}}}));
  await page.route('**/api/review/commands',async(route:any)=>{commands.push(route.request().postDataJSON());await route.fulfill({json:{status:'applied'}});});
  return commands;
}


test('one new queue has two desktop columns and no scoring or bought shortcut on the tile',async({page})=>{
  await fixtures(page);await page.goto('/zhezhemon/processing');
  await expect(page.getByRole('heading',{name:/Нові сповіщення/})).toBeVisible();
  await expect(page.getByRole('tab')).toHaveCount(0);
  await expect(page.locator('aside')).toHaveCount(0);
  await expect(page.locator('article')).toHaveCount(4);
  const first=(await page.locator('article').nth(0).boundingBox())!,second=(await page.locator('article').nth(1).boundingBox())!;
  expect(first.y).toBe(second.y);expect(second.x).toBeGreaterThan(first.x+first.width);
  await expect(page.getByRole('button',{name:'✅ Купив',exact:true})).toHaveCount(0);
  await expect(page.getByText('В роботі',{exact:true})).toHaveCount(0);
  await page.screenshot({path:'node_modules/.cache/stage1-new-desktop.png'});
});
test('tile separates product, photos and drawer; gallery survives polling and supports keyboard',async({page})=>{
  await page.clock.install();
  const photos=[{source_url:'https://i.ebayimg.com/one.jpg',status:'url_only'},{source_url:'https://i.ebayimg.com/two.jpg',status:'url_only'}];
  await fixtures(page,photos,{part_number:'MWWT3',part_number_status:'identified',part_number_source:'mpn',manual_part_number:null,part_number_version:1});
  await page.route('https://i.ebayimg.com/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="160" height="160" fill="#cbd8dd"/><text x="22" y="85" fill="#17232e">Фото товару</text></svg>'}));
  await page.goto('/zhezhemon/processing');const tile=page.locator('article').first();
  await expect(tile.getByRole('link',{name:/ThinkPad/})).toHaveAttribute('href',link);
  await expect(tile.getByRole('link',{name:/ThinkPad/})).toHaveAttribute('target','_blank');
  await tile.getByText('📦 ≈2 шт.',{exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(tile.getByText(/ · Lenovo$/)).toBeVisible();
  await expect(page.getByText('Кожні 30 с',{exact:true})).toHaveCount(0);
  const cover=tile.getByRole('button',{name:/Переглянути фото:/});await cover.click();
  const gallery=page.getByRole('dialog',{name:/Фото товару:/});await expect(gallery).toBeVisible();
  await expect(gallery.getByRole('img',{name:'Фото 1 з 2',exact:true})).toHaveAttribute('src',photos[0].source_url);
  await page.keyboard.press('ArrowRight');await expect(gallery.getByRole('img',{name:'Фото 2 з 2',exact:true})).toHaveAttribute('src',photos[1].source_url);
  await page.clock.runFor(30300);await expect(gallery.getByRole('img',{name:'Фото 2 з 2',exact:true})).toBeVisible();
  await page.keyboard.press('Escape');await expect(gallery).toHaveCount(0);await expect(cover).toBeFocused();
  await page.screenshot({path:'node_modules/.cache/board-tile-photos-desktop.png'});
  await page.setViewportSize({width:390,height:844});
  await expect.poll(async()=>Math.round((await cover.boundingBox())!.width)).toBe(64);
  const photoBox=(await cover.boundingBox())!,priceBox=(await tile.getByText('202.30 USD',{exact:true}).boundingBox())!;
  expect(priceBox.x).toBeGreaterThan(photoBox.x+photoBox.width);
  await page.screenshot({path:'node_modules/.cache/board-tile-photos-mobile.png'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await tile.getByRole('button',{name:/Відкрити картку:/}).click();await expect(page.getByRole('dialog')).toBeVisible();
});

for(const viewport of [{width:320,height:640},{width:390,height:844},{width:844,height:390},{width:1024,height:720},{width:1440,height:1000}]) {
  test(`gallery contains portrait, landscape and small images at ${viewport.width}x${viewport.height}`,async({page})=>{
    await page.setViewportSize(viewport);
    const dimensions=[[2000,4000],[4000,1000],[64,64]],photos=Array.from({length:9},(_,i)=>({source_url:`https://i.ebayimg.com/orientation-${i}.svg`,status:'url_only'}));
    await fixtures(page,photos,{title:'Apple Watch Series 10 46mm Jet Black Aluminum GPS Watch Only - Open Box '.repeat(3)});
    await page.route('https://i.ebayimg.com/**',route=>{
      const i=Number(new URL(route.request().url()).pathname.match(/orientation-(\d+)/)?.[1] ?? 0),[w,h]=dimensions[i%3];
      return route.fulfill({contentType:'image/svg+xml',body:`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect x="0" y="0" width="${w}" height="${h}" fill="#cbd8dd"/><rect x="${w*.05}" y="${h*.05}" width="${w*.9}" height="${h*.9}" fill="#7bdbcc"/><circle cx="${w*.5}" cy="${h*.5}" r="${Math.min(w,h)*.2}" fill="#26363e"/></svg>`});
    });
    await page.goto('/zhezhemon/processing');await page.locator('article').first().getByRole('button',{name:/Переглянути фото:/}).click();
    const gallery=page.getByRole('dialog',{name:/Фото товару:/});await expect(gallery).toBeVisible();
    let frame:{width:number;height:number}|null=null;
    for(let index=0;index<3;index++) {
      if(index>0)await gallery.getByRole('button',{name:`Показати фото ${index+1}`,exact:true}).click();
      const image=gallery.getByRole('img',{name:`Фото ${index+1} з 9`,exact:true});
      await expect.poll(()=>image.evaluate((img:HTMLImageElement)=>img.complete && img.naturalWidth>0)).toBe(true);
      const bounds=(await gallery.boundingBox())!,imageBounds=(await image.boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.x+bounds.width).toBeLessThanOrEqual(viewport.width);expect(bounds.y+bounds.height).toBeLessThanOrEqual(viewport.height);
      expect(imageBounds.x).toBeGreaterThanOrEqual(bounds.x);expect(imageBounds.x+imageBounds.width).toBeLessThanOrEqual(bounds.x+bounds.width);
      expect(imageBounds.y+imageBounds.height).toBeLessThanOrEqual(bounds.y+bounds.height);
      expect(await image.evaluate(img=>getComputedStyle(img).objectFit)).toBe('contain');
      expect(imageBounds.height).toBeGreaterThan(30);
      if(frame){expect(imageBounds.width).toBeCloseTo(frame.width,1);expect(imageBounds.height).toBeCloseTo(frame.height,1)}
      frame=imageBounds;
      for(const name of ['Закрити фото','Попереднє фото','Наступне фото'])await expect(gallery.getByRole('button',{name,exact:true})).toBeInViewport({ratio:1});
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      if(index<2 && [390,1440].includes(viewport.width))await page.screenshot({path:`node_modules/.cache/gallery-${viewport.width}-${index===0?'portrait':'landscape'}.png`});
    }
    if(viewport.width<640){
      const strip=gallery.getByRole('button',{name:'Показати фото 9',exact:true}).locator('..');
      expect(await strip.evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(true);
      await gallery.getByRole('button',{name:'Показати фото 9',exact:true}).click();await expect(gallery.getByRole('img',{name:'Фото 9 з 9',exact:true})).toBeVisible();
    }
  });
}

test('mixed cards keep their editors collapsed; missing part number opens and closes via the badge',async({page})=>{
  await fixtures(page);
  const rows=[{...card,part_number:'MWWT3',part_number_status:'identified',part_number_source:'mpn'}, {...card,id:'33333333-3333-4333-8333-333333333333'}];
  await page.route('**/api/review/boards?**',route=>route.fulfill({json:{pending:2,columns:{new:{count:2,cards:rows},processed:{count:0,cards:[]}}}}));
  await page.goto('/zhezhemon/processing');await expect(page.locator('article')).toHaveCount(2);
  await expect(page.getByRole('textbox',{name:'Партійний номер'})).toHaveCount(0);
  const known=(await page.locator('article').first().boundingBox())!,missing=(await page.locator('article').nth(1).boundingBox())!;
  expect(missing.y).toBe(known.y);expect(missing.height).toBe(known.height);
  const tile=page.locator('article').nth(1),badge=tile.getByRole('button',{name:'Змінити партійний номер: Без партійного',exact:true}),input=tile.getByRole('textbox',{name:'Партійний номер'});
  await expect(badge).toHaveAttribute('aria-expanded','false');await badge.click();await expect(input).toBeVisible();
  await expect(badge).toHaveAttribute('aria-expanded','true');await input.fill('DRAFT123');
  await badge.click();await expect(input).toBeHidden();await badge.click();await expect(input).toHaveValue('DRAFT123');
  await tile.getByRole('button',{name:'Закрити редагування партійного',exact:true}).click();await expect(input).toBeHidden();
  await badge.click();await expect(input).toHaveValue('');
});

test('drawer starts details and context together, shows queued title immediately and details before actions are ready',async({page})=>{
  await fixtures(page);let detailStarted=false,contextStarted=false,releaseDetail:()=>void=()=>{},releaseContext:()=>void=()=>{};
  const heldDetail=new Promise<void>(resolve=>{releaseDetail=resolve}),heldContext=new Promise<void>(resolve=>{releaseContext=resolve});
  await page.route('**/api/review/boards?**',async route=>{
    if(!new URL(route.request().url()).searchParams.has('id'))return route.fallback();
    detailStarted=true;await heldDetail;await route.fulfill({json:detail});
  });
  await page.route('**/api/review/contexts',async route=>{contextStarted=true;await heldContext;return route.fallback()});
  await page.goto('/zhezhemon/processing');await page.locator('article').first().getByRole('button',{name:/Відкрити картку:/}).click();
  const panel=page.getByRole('dialog');await expect(panel.locator('#card-title')).toHaveText(`${card.title} 1`);
  await expect(panel.getByRole('link',{name:'Відкрити на eBay ↗',exact:true})).toBeVisible();
  await expect.poll(()=>detailStarted && contextStarted).toBe(true);
  releaseDetail();await expect(panel.getByRole('heading',{name:'Дані оголошення на момент повідомлення',exact:true})).toBeVisible();
  await expect(panel.getByRole('button',{name:'⏱ Не встиг',exact:true})).toBeDisabled();
  releaseContext();await expect(panel.getByRole('button',{name:'⏱ Не встиг',exact:true})).toBeEnabled();
});

test('direct drawer links show details while their delivery context is loading',async({page})=>{
  await fixtures(page);let release:()=>void=()=>{};const held=new Promise<void>(resolve=>{release=resolve});
  await page.route('**/api/review/contexts',async route=>{await held;return route.fallback()});
  await page.goto(`/zhezhemon/processing?card=${id}`);const panel=page.getByRole('dialog');
  await expect(panel.getByRole('heading',{name:'Дані оголошення на момент повідомлення',exact:true})).toBeVisible();
  await expect(panel.getByRole('button',{name:'✅ Купив вручну',exact:true})).toBeDisabled();
  release();await expect(panel.getByRole('button',{name:'✅ Купив вручну',exact:true})).toBeEnabled();
});

test('drawer URL updates and browser back work without server navigation or losing filters',async({page})=>{
  await fixtures(page);await page.goto('/zhezhemon/processing?notifications.kind=first_seen');
  await expect(page.locator('article')).toHaveCount(4);let serverNavigations=0;
  page.on('request',request=>{const url=new URL(request.url());if(request.headers()['rsc']==='1' && url.pathname==='/zhezhemon/processing')serverNavigations++});
  await page.locator('article').first().getByRole('button',{name:/Відкрити картку:/}).click();
  await expect(page.getByRole('dialog')).toBeVisible();await expect(page).toHaveURL(new RegExp(`card=${id}`));
  await page.getByRole('dialog').getByRole('button',{name:'Закрити ×'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(new URL(page.url()).searchParams.get('notifications.kind')).toBe('first_seen');
  await page.goBack();await expect(page.getByRole('dialog')).toBeVisible();await expect(page).toHaveURL(new RegExp(`card=${id}`));
  await page.goBack();await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(serverNavigations).toBe(0);
});

test('failed or mismatched parallel context leaves visible details and disabled actions',async({page})=>{
  await fixtures(page);let fail=true;
  await page.route('**/api/review/contexts',route=>route.fulfill(fail?{status:503,json:{error:'context_unavailable'}}:
    {json:{id,kind:'delivery',delivery_id:delivery,result_version:1}}));
  await page.goto('/zhezhemon/processing');await page.locator('article').first().getByRole('button',{name:/Відкрити картку:/}).click();
  const panel=page.getByRole('dialog');await expect(panel.getByRole('heading',{name:'Дані оголошення на момент повідомлення',exact:true})).toBeVisible();
  await expect(panel.getByRole('alert')).toHaveText('Дані картки завантажено, але дії недоступні. Онови картку.');
  await expect(panel.getByRole('button',{name:'⏱ Не встиг',exact:true})).toBeDisabled();
  fail=false;await panel.getByRole('button',{name:'Оновити',exact:true}).click();
  await expect(panel.getByText('Картка змінилась під час відкриття. Онови її.',{exact:true})).toBeVisible();
  await expect(panel.getByRole('button',{name:'⏱ Не встиг',exact:true})).toBeDisabled();
});

test('reloading a changed canonical delivery prepares the new context instead of reusing the queue hint',async({page})=>{
  await fixtures(page);const replacement='55555555-5555-4555-8555-555555555555',targets:string[]=[];
  await page.route('**/api/review/boards?**',route=>new URL(route.request().url()).searchParams.has('id')?
    route.fulfill({json:{...detail,card:{...card,delivery_id:replacement}}}):route.fallback());
  await page.route('**/api/review/contexts',route=>{const target=route.request().postDataJSON().target;targets.push(target);
    return route.fulfill({json:{id,kind:'delivery',delivery_id:target,result_version:0}})});
  await page.goto('/zhezhemon/processing');await page.locator('article').first().getByRole('button',{name:/Відкрити картку:/}).click();
  const panel=page.getByRole('dialog');await expect(panel.getByText('Картка змінилась під час відкриття. Онови її.',{exact:true})).toBeVisible();
  await panel.getByRole('button',{name:'Оновити',exact:true}).click();await expect(panel.getByRole('button',{name:'⏱ Не встиг',exact:true})).toBeEnabled();
  // Development Strict Mode may start the first effect twice; refresh must only use the new delivery.
  const fresh=targets.indexOf(replacement);expect(fresh).toBeGreaterThan(0);
  expect(targets.slice(0,fresh).every(target=>target===delivery)).toBe(true);
  expect(targets.slice(fresh).every(target=>target===replacement)).toBe(true);
});

test('drawer records a manual total, edits it and cancels with a reason',async({page})=>{
  await fixtures(page);let manual:number|null=null;const writes:any[]=[];
  await page.route('**/api/review/boards?**',async route=>{
    if(!new URL(route.request().url()).searchParams.has('id'))return route.fallback();
    await route.fulfill({json:{...detail,card:{...card,stage:manual?'processed':'new',outcome:manual?'bought':null,
      manual_purchase_quantity:manual,manual_purchase_pending_units:manual ?? 0,manual_purchase_at:manual?at:null},
      view:{...view,outcome:manual?'bought':null,outcomeSource:manual?'manual':null}}});
  });
  await page.route('**/api/review/commands',async route=>{const body=route.request().postDataJSON();writes.push(body);
    manual=body.action==='set_manual_purchase'?body.payload.quantity:null;await route.fulfill({json:{status:'applied'}});
  });
  await page.goto('/zhezhemon/processing');await page.locator('article').first().getByRole('button',{name:/Відкрити картку:/}).click();
  const panel=page.getByRole('dialog');await panel.getByRole('button',{name:'✅ Купив вручну',exact:true}).click();
  const quantity=panel.getByLabel('Куплено через цю картку, шт.');await quantity.fill('0');
  await expect(panel.getByRole('button',{name:'Зберегти «Купив»'})).toBeDisabled();await quantity.fill('2');
  await panel.getByRole('button',{name:'Зберегти «Купив»'}).click();await expect(panel.getByText('Купив · вручну · 2 шт.',{exact:true})).toBeVisible();
  await expect(panel.getByText('Є підтвердження ERP. Прив’язку закупки можна виправити нижче.')).toHaveCount(0);
  expect(writes[0]).toMatchObject({action:'set_manual_purchase',payload:{quantity:2}});
  await panel.getByRole('button',{name:'Змінити кількість «Купив»'}).click();await quantity.fill('3');
  await panel.getByRole('button',{name:'Зберегти «Купив»'}).click();await expect(panel.getByText('Купив · вручну · 3 шт.',{exact:true})).toBeVisible();
  await page.screenshot({path:'node_modules/.cache/manual-purchase-drawer.png'});
  await panel.getByRole('button',{name:'Скасувати ручну позначку'}).click();
  await expect(panel.getByRole('button',{name:'Скасувати «Купив»',exact:true})).toBeDisabled();
  await panel.getByLabel('Причина скасування «Купив»').fill('Помилкова картка');
  await panel.getByRole('button',{name:'Скасувати «Купив»',exact:true}).click();await expect(panel.getByText('Результату немає',{exact:true})).toBeVisible();
  expect(writes[2]).toMatchObject({action:'clear_manual_purchase',payload:{reason:'Помилкова картка'}});
});

test('mobile manual quantity draft survives polling; saving it preserves an unsaved bug note',async({page})=>{
  await page.clock.install();await fixtures(page);await page.setViewportSize({width:390,height:844});
  await page.goto('/zhezhemon/processing');await page.locator('article').first().getByRole('button',{name:/Відкрити картку:/}).click();
  const panel=page.getByRole('dialog');await panel.getByRole('button',{name:'✅ Купив вручну',exact:true}).click();
  await panel.getByLabel('Куплено через цю картку, шт.').fill('2');await page.clock.runFor(30300);
  await expect(panel.getByLabel('Куплено через цю картку, шт.')).toHaveValue('2');
  await expect(panel.getByText('Дані змінились. Онови картку перед наступною дією.',{exact:true})).toBeVisible();
  page.once('dialog',dialog=>dialog.accept());await panel.getByRole('button',{name:'Оновити',exact:true}).click();
  await panel.getByRole('button',{name:'🐞 Баг',exact:true}).click();await panel.getByLabel('Що пішло не так').fill('Зберегти цей текст');
  await panel.getByRole('button',{name:'✅ Купив вручну',exact:true}).click();await panel.getByLabel('Куплено через цю картку, шт.').fill('3');
  await panel.getByRole('button',{name:'Зберегти «Купив»'}).click();await expect(panel.getByLabel('Що пішло не так')).toHaveValue('Зберегти цей текст');
  await expect(panel.getByText('Дані змінились. Онови картку перед наступною дією.',{exact:true})).toBeVisible();
});

test('inline part number normalizes, saves and clears using the current version without opening a drawer',async({page})=>{
  await fixtures(page);let manual:string|null=null,version:number|null=null;const writes:any[]=[];
  await page.route('**/api/review/boards?**',async route=>{
    if(new URL(route.request().url()).searchParams.has('id'))return route.fallback();
    await route.fulfill({json:{pending:1,columns:{new:{count:1,cards:[{...card,manual_part_number:manual,part_number_version:version}]},processed:{count:0,cards:[]}}}});
  });
  await page.route('**/api/review/part-numbers',async route=>{
    const body=route.request().postDataJSON();writes.push(body);manual=body.partNumber;version=(version ?? 0)+1;
    await route.fulfill({json:{status:'applied',partNumber:{manual_part_number:manual,version}}});
  });
  await page.goto('/zhezhemon/processing');const tile=page.locator('article').first(),input=tile.getByRole('textbox',{name:'Партійний номер'});
  await expect(input).toBeHidden();await tile.getByRole('button',{name:/Змінити партійний номер:/}).click();
  await input.fill(' mxp93ll/a ');await tile.getByRole('button',{name:'Зберегти',exact:true}).click();
  await expect.poll(()=>writes.length).toBe(1);expect(writes[0]).toMatchObject({link,partNumber:'MXP93LL/A',version:null});
  await expect(input).toBeHidden();await expect(tile.getByText('✍️ MXP93LL/A · чекає ERP',{exact:true})).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await tile.getByRole('button',{name:/Змінити партійний номер:/}).click();await expect(input).toHaveValue('MXP93LL/A');
  await tile.getByRole('button',{name:'Очистити',exact:true}).click();await expect.poll(()=>writes.length).toBe(2);
  expect(writes[1]).toMatchObject({link,partNumber:null,version:1});await expect(input).toBeHidden();
  await tile.getByRole('button',{name:/Змінити партійний номер:/}).click();await expect(input).toHaveValue('');
});

test('polling reloads the board only when the change signal moves',async({page})=>{
  await page.clock.install();await fixtures(page);let version=7,loads=0,checks=0;
  await page.route('**/api/review/boards/version',route=>{checks++;return route.fulfill({json:{version}})});
  await page.route('**/api/review/boards?**',route=>{loads++;return route.fulfill({json:{version,pending:1,columns:{new:{count:1,cards:[{...card,title:`Signal ${version}`}]},processed:{count:0,cards:[]}}}})});
  await page.goto('/zhezhemon/processing');await expect(page.getByText('Signal 7')).toBeVisible();
  const initial=loads;await page.clock.runFor(30300);await expect.poll(()=>checks).toBeGreaterThan(0);
  await page.clock.runFor(30300);expect(loads).toBe(initial);
  version=8;await page.clock.runFor(30300);await expect(page.getByText('Signal 8')).toBeVisible();expect(loads).toBe(initial+1);
});

test('polling preserves an inline draft and requires reconciliation after a concurrent part-number change',async({page})=>{
  await page.clock.install();await fixtures(page);let manual='OLD123',version=1;
  await page.route('**/api/review/boards?**',async route=>route.fulfill({json:{pending:1,columns:{new:{count:1,cards:[{...card,manual_part_number:manual,part_number_version:version}]},processed:{count:0,cards:[]}}}}));
  await page.goto('/zhezhemon/processing');const tile=page.locator('article').first(),input=tile.getByRole('textbox',{name:'Партійний номер'});
  await expect(input).toBeHidden();await tile.getByRole('button',{name:/Змінити партійний номер:/}).click();
  await input.fill('MY-DRAFT');manual='OTHER123';version=2;await page.clock.runFor(30300);
  await expect(input).toHaveValue('MY-DRAFT');await expect(tile.getByRole('button',{name:'Зберегти',exact:true})).toBeDisabled();
  await tile.getByRole('button',{name:'Оновити значення',exact:true}).click();await expect(input).toHaveValue('OTHER123');
});

test('identified part number opens on badge click and closes without changing the automatic number',async({page})=>{
  await fixtures(page);
  await page.route('**/api/review/boards?**',async route=>route.fulfill({json:{pending:1,columns:{new:{count:1,cards:[{...card,part_number:'MWWT3',part_number_status:'identified',part_number_source:'mpn',manual_part_number:null,part_number_version:1}]},processed:{count:0,cards:[]}}}}));
  await page.goto('/zhezhemon/processing');const tile=page.locator('article').first(),input=tile.getByRole('textbox',{name:'Партійний номер'});
  await expect(input).toBeHidden();await tile.getByRole('button',{name:'Змінити партійний номер: MWWT3',exact:true}).click();
  await expect(input).toBeVisible();await expect(input).toHaveAttribute('placeholder','MWWT3');
  await input.fill('UNSAVED123');await tile.getByRole('button',{name:'Закрити редагування партійного',exact:true}).click();await expect(input).toBeHidden();
  await expect(tile.getByText('MWWT3',{exact:true})).toBeVisible();
});

test('newly identified automatic part number does not collapse or erase an unsaved manual draft',async({page})=>{
  await page.clock.install();await fixtures(page);let identified=false;
  await page.route('**/api/review/boards?**',async route=>route.fulfill({json:{pending:1,columns:{new:{count:1,cards:[{...card,part_number:identified?'AUTO123':null,part_number_status:identified?'identified':'unknown',part_number_source:identified?'mpn':null,part_number_version:identified?2:1}]},processed:{count:0,cards:[]}}}}));
  await page.goto('/zhezhemon/processing');const tile=page.locator('article').first(),input=tile.getByRole('textbox',{name:'Партійний номер'});
  await tile.getByRole('button',{name:/Змінити партійний номер:/}).click();
  await input.fill('MY-DRAFT');identified=true;await page.clock.runFor(30300);
  await expect(input).toBeVisible();await expect(input).toHaveValue('MY-DRAFT');await expect(tile.getByRole('button',{name:'Зберегти',exact:true})).toBeDisabled();
});

test.describe('mobile queue scrolling',()=>{
  test.use({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  for(const stage of ['new','processed'])test(`${stage} keeps the complete card list after keyboard viewport shrink and restore`,async({page})=>{
    await fixtures(page);await page.goto(`/zhezhemon/${stage==='new'?'processing':'processed'}`);
    const queue=page.getByRole('region',{name:stage==='new'?'Нові картки':'Оброблені картки'}),input=page.locator('article').nth(1).getByRole('textbox',{name:'Партійний номер'});
    await page.locator('article').nth(1).getByRole('button',{name:/Змінити партійний номер:/}).click();
    await input.fill('KEYBOARD-DRAFT');const listHeight=await queue.evaluate(el=>el.clientHeight);
    await page.setViewportSize({width:390,height:480});
    await expect(input).toHaveValue('KEYBOARD-DRAFT');expect(await queue.evaluate(el=>el.clientHeight)).toBe(listHeight);
    await input.evaluate(el=>el.blur());await page.setViewportSize({width:390,height:844});
    expect(await queue.evaluate(el=>el.clientHeight)).toBe(listHeight);await expect(input).toHaveValue('KEYBOARD-DRAFT');
    // A card near the bottom remains reachable; no clipped half-height list.
    await page.locator('article').last().scrollIntoViewIfNeeded();await expect(page.locator('article').last()).toBeInViewport();
    const styles=await queue.evaluate(el=>({queue:getComputedStyle(el).overflowY,board:getComputedStyle(el.closest('main')!).overflowY}));
    expect(styles).toEqual({queue:'visible',board:'visible'});
    await page.getByRole('button',{name:'Фільтри',exact:true}).click();const filter=page.getByLabel('Лінк або заголовок');
    await filter.fill('Watch');await page.setViewportSize({width:390,height:480});await filter.evaluate(el=>el.blur());await page.setViewportSize({width:390,height:844});
    await expect(filter).toHaveValue('Watch');expect(await queue.evaluate(el=>el.clientHeight)).toBe(listHeight);
    await page.screenshot({path:`node_modules/.cache/keyboard-restored-${stage}-mobile.png`});
  });
  for(const stage of ['new','processed'])test(`${stage} queue responds to touch scrolling and retains its position after refresh`,async({page})=>{
    await fixtures(page);
    await page.route('**/api/review/boards?**',async route=>{
      const rows=Array.from({length:20},(_,i)=>({...card,id:`33333333-3333-4333-8333-${String(i).padStart(12,'0')}`,title:`Mobile item ${i}`,stage,part_number:'MWWT3',part_number_status:'identified',part_number_source:'mpn',...(stage==='processed'?{outcome:'funds'}:{})}));
      await route.fulfill({json:{pending:stage==='new'?20:0,columns:{new:{count:stage==='new'?20:0,cards:stage==='new'?rows:[]},processed:{count:stage==='processed'?20:0,cards:stage==='processed'?rows:[]}}}});
    });
    await page.goto(`/zhezhemon/${stage==='new'?'processing':'processed'}`);await expect(page.locator('article')).toHaveCount(20);
    const queue=page.getByRole('region',{name:stage==='new'?'Нові картки':'Оброблені картки'});
    expect(await page.evaluate(()=>document.documentElement.scrollHeight)).toBeGreaterThan(844);
    expect(await queue.evaluate(el=>getComputedStyle(el).overflowY)).toBe('visible');
    const box=(await queue.boundingBox())!;
    const cdp=await page.context().newCDPSession(page);
    const x=Math.round(box.x+box.width/2),y=744;
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
    for(let distance=35;distance<=350;distance+=35)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-distance}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBeGreaterThan(100);
    // Refresh while scrolled down without Playwright scrolling the toolbar into view.
    await page.getByRole('button',{name:'Оновити',exact:true}).evaluate((button:HTMLButtonElement)=>button.click());
    const before=await page.evaluate(()=>window.scrollY);await expect(page.getByRole('button',{name:'Оновити',exact:true})).toBeEnabled();
    await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBe(before);await cdp.detach();
    await page.screenshot({path:`node_modules/.cache/compact-${stage}-mobile-scroll.png`});
  });
});

test('journal has processed cards with editing through the panel',async({page})=>{
  await fixtures(page);await page.goto('/zhezhemon/processed');
  await expect(page.getByRole('heading',{name:/Журнал оброблених/})).toBeVisible();
  await expect(page.locator('article')).toHaveCount(4);
  await expect(page.getByRole('group',{name:/Результат:/})).toHaveCount(0);
  await page.getByRole('button',{name:/Відкрити картку: ThinkPad/}).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
});
test('filter URL survives reload and closing a card',async({page})=>{
  await fixtures(page);await page.goto('/zhezhemon/processing?notifications.search=1');
  await page.getByRole('button',{name:'Фільтри',exact:true}).click();
  await page.getByLabel('Лінк або заголовок').fill('none');await page.getByRole('button',{name:'Застосувати'}).click();
  await expect(page.locator('article')).toHaveCount(0);await page.reload();
  await page.getByRole('button',{name:'Фільтри',exact:true}).click();await expect(page.getByLabel('Лінк або заголовок')).toHaveValue('none');
});
test('card uses pinned delivery context, safe snapshot and note-required bug',async({page})=>{
  let reads=0;page.on('response',r=>{const p=new URL(r.url());if(p.pathname==='/api/review/boards' && !p.searchParams.has('id'))reads++});
  const commands=await fixtures(page);await page.goto(`/zhezhemon/processing?card=${id}&action=bug&notifications.search=1`);
  const panel=page.getByRole('dialog');await expect(panel).toBeVisible();
  await expect.poll(()=>reads).toBeGreaterThanOrEqual(1);await expect(panel.getByRole('button',{name:'⏱ Не встиг',exact:true})).toBeEnabled();
  const save=panel.getByRole('button',{name:'Записати баг'});await expect(save).toBeDisabled();
  await panel.getByLabel('Що пішло не так').fill('Wrong model');await save.click();
  await expect.poll(()=>commands.length).toBe(1);expect(commands[0].action).toBe('set_outcome');expect(commands[0].payload).toEqual({value:'bug',note:'Wrong model'});
  await expect(panel.getByRole('combobox',{name:/: бал/})).toHaveCount(0);
  await panel.getByRole('heading',{name:'Дані оголошення на момент повідомлення'}).scrollIntoViewIfNeeded();
  await expect(panel.getByText('Текст продавця',{exact:true})).toBeVisible();expect(await page.evaluate(()=>Boolean((window as any).bad))).toBe(false);
  await panel.getByRole('button',{name:'Закрити ×'}).click();await expect(page).toHaveURL(/notifications.search=1/);await expect(page).not.toHaveURL(/action=/);
});
test('missed is one click without a reason; funds is separate',async({page})=>{
  const commands=await fixtures(page);await page.goto('/zhezhemon/processing');
  await page.getByRole('button',{name:'⏱ Не встиг',exact:true}).first().click();
  await expect.poll(()=>commands.length).toBe(1);expect(commands[0].payload).toEqual({value:'missed'});
  await page.getByRole('button',{name:'💰 Кошти',exact:true}).first().click();
  await expect.poll(()=>commands.length).toBe(2);expect(commands[1].payload).toEqual({value:'funds'});
});
test('mobile has one column, full-screen card and protected unsaved note',async({page})=>{
  await page.setViewportSize({width:390,height:844});await fixtures(page);await page.goto('/zhezhemon/processing');
  await expect(page.locator('article')).toHaveCount(4);const a=(await page.locator('article').nth(0).boundingBox())!,b=(await page.locator('article').nth(1).boundingBox())!;expect(b.x).toBe(a.x);expect(b.y).toBeGreaterThan(a.y+a.height);
  await page.getByRole('button',{name:'🐞 Баг',exact:true}).first().click();const panel=page.getByRole('dialog');await expect(panel).toBeVisible();expect((await panel.boundingBox())!.width).toBe(390);
  await panel.getByLabel('Що пішло не так').fill('Unsaved');page.once('dialog',d=>d.dismiss());await panel.getByRole('button',{name:'Закрити ×'}).click();await expect(panel).toBeVisible();
  await page.screenshot({path:'node_modules/.cache/stage1-card-mobile.png'});
  page.once('dialog',d=>d.accept());await panel.getByRole('button',{name:'Закрити ×'}).click();await expect(panel).toHaveCount(0);
});
test('actual ERP fact assignment posts existing fact with both versions',async({page})=>{
  await fixtures(page);const assignments:any[]=[];
  await page.route('**/api/review/boards?**',async route=>{const p=new URL(route.request().url()).searchParams;if(!p.get('id'))return route.fallback();return route.fulfill({json:{...detail,erpPurchases:[{order_key:'draft:3:123',lifecycle:'draft',draft_id:3,purchase_id:null,quantity:null,cancelled_units:0,time_basis:'email',email_at:at,active:true,assigned_event_id:null,assignment_source:'automatic',version:4}]}})});
  await page.route('**/api/review/purchases',async route=>{assignments.push(route.request().postDataJSON());return route.fulfill({json:{status:'applied'}})});
  await page.goto(`/zhezhemon/processing?card=${id}`);const button=page.getByRole('button',{name:'Прив’язати до цієї картки'});await expect(button).toBeEnabled();await button.click();
  await expect.poll(()=>assignments.length).toBe(1);expect(assignments[0]).toMatchObject({contextId:id,key:'draft:3:123',version:4,assign:true});expect(assignments[0].commandId).toMatch(/^[0-9a-f-]{36}$/);
});
test('new queue polls every 30 seconds without overlapping or shifting cards',async({page})=>{
  await page.clock.install();await fixtures(page);
  let reads=0,release:()=>void=()=>{};
  const held=new Promise<void>(resolve=>{release=resolve});
  await page.route('**/api/review/boards?**',async route=>{
    const params=new URL(route.request().url()).searchParams;if(params.get('id'))return route.fallback();
    reads++;if(reads===2)await held;
    const rows=Array.from({length:4},(_,i)=>({...card,id:i===0?id:`33333333-3333-4333-8333-${String(i).padStart(12,'0')}`,title:`Poll item ${i}`}));
    await route.fulfill({json:{pending:4,columns:{new:{count:4,cards:rows},processed:{count:0,cards:[]}}}});
  });
  await page.goto('/zhezhemon/processing');await expect(page.locator('article')).toHaveCount(4);
  expect(await page.evaluate(()=>(window as any).__reviewRealtime.length)).toBe(0);
  const before=(await page.locator('article').first().boundingBox())!;
  await page.clock.runFor(29999);expect(reads).toBe(1);
  await page.clock.runFor(301);await expect.poll(()=>reads).toBe(2);
  await expect(page.getByRole('button',{name:'Оновлюю…',exact:true})).toBeDisabled();
  const during=(await page.locator('article').first().boundingBox())!;
  expect(during.y).toBe(before.y);expect(during.x).toBe(before.x);
  await expect(page.getByRole('status')).toHaveCount(0);
  await page.clock.runFor(30000);expect(reads).toBe(2);
  release();await expect(page.getByRole('button',{name:'Оновити',exact:true})).toBeEnabled();
  await page.clock.runFor(300);await expect.poll(()=>reads).toBe(3);
});
test('ERP assignment and polling preserve unsaved bug text until explicit reload',async({page})=>{
  await page.clock.install();
  await fixtures(page);
  await page.route('**/api/review/boards?**',async route=>{if(!new URL(route.request().url()).searchParams.get('id'))return route.fallback();return route.fulfill({json:{...detail,erpPurchases:[{order_key:'draft:3:123',lifecycle:'draft',quantity:null,time_basis:'email',email_at:at,active:true,assigned_event_id:null,assignment_source:'automatic',version:4}]}})});
  await page.route('**/api/review/purchases',route=>route.fulfill({json:{status:'applied'}}));
  await page.goto(`/zhezhemon/processing?card=${id}&action=bug`);const panel=page.getByRole('dialog'),note=panel.getByLabel('Що пішло не так');
  await note.fill('Keep this draft');await panel.getByRole('button',{name:'Прив’язати до цієї картки'}).click();
  await expect(note).toHaveValue('Keep this draft');await expect(panel.getByRole('button',{name:'Записати баг'})).toBeDisabled();
  await page.clock.runFor(30300);
  await expect(note).toHaveValue('Keep this draft');page.once('dialog',d=>d.dismiss());await panel.getByRole('button',{name:'Оновити',exact:true}).click();await expect(note).toHaveValue('Keep this draft');
});
test('pagination preserves all loaded cards across queue invalidation',async({page})=>{
  await fixtures(page);let generation=0;
  await page.route('**/api/review/boards?**',async route=>{
    const p=new URL(route.request().url()).searchParams;if(p.get('id'))return route.fallback();
    const all=Array.from({length:60},(_,i)=>({...card,id:`44444444-4444-4444-8444-${String(i).padStart(12,'0')}`,title:`Page item ${i} · ${generation}`}));
    const start=p.has('newId')?Number(p.get('newId')!.slice(-12))+1:0;
    return route.fulfill({json:{pending:60,columns:{new:{count:60,cards:all.slice(start,start+50)},processed:{count:0,cards:[]}}}});
  });
  await page.goto('/zhezhemon/processing');await expect(page.locator('article')).toHaveCount(50);
  await page.getByRole('button',{name:'Ще 50'}).focus();await page.keyboard.press('Enter');await expect(page.locator('article')).toHaveCount(60);
  generation=1;await page.getByRole('button',{name:'Оновити',exact:true}).click();
  await expect(page.getByRole('button',{name:/Page item 59 · 1/})).toBeVisible();await expect(page.locator('article')).toHaveCount(60);
});
test('real APIs keep authentication, origin and feature gates; retired APIs are absent',async({page})=>{
  const request=page.request;
  expect((await request.get('/api/review/boards')).status()).toBe(503);
  expect((await request.post('/api/review/purchases',{headers:{Origin:'https://foreign.invalid'},data:{}})).status()).toBe(403);
  expect((await request.post('/api/review/purchases',{headers:{Origin:'http://127.0.0.1:3217'},data:{}})).status()).toBe(503);
  expect((await request.get('/api/review/assessments')).status()).toBe(404);
  expect((await request.get('/api/review/reporting')).status()).toBe(404);
});
test('cancelled purchase can be linked as history and unlinked; withdrawn records stay unavailable',async({page})=>{
  await fixtures(page);let assigned=false;const writes:any[]=[];
  const cancelled={order_key:'cancelled-order',lifecycle:'purchase',draft_id:1,purchase_id:10,quantity:0,
    cancelled_units:2,quantity_basis:'items',time_basis:'email',email_at:at,scope_date:'2026-09-11',
    active:false,assigned_event_id:null,assignment_source:'manual',version:1};
  await page.route('**/api/review/boards?**',async route=>{
    if(!new URL(route.request().url()).searchParams.has('id'))return route.fallback();
    await route.fulfill({json:{...detail,card:{...card,stage:assigned?'processed':'new',
      outcome:assigned?'purchase_cancelled':null,erp_cancelled_purchases:assigned?1:0},
      view:{...view,outcome:assigned?'purchase_cancelled':null},erpPurchases:[
        {...cancelled,assigned_event_id:assigned?id:null,version:assigned?2:3},
        {...cancelled,order_key:'withdrawn-order',purchase_id:11,lifecycle:'withdrawn'},
      ]}});
  });
  await page.route('**/api/review/purchases',async route=>{
    const body=route.request().postDataJSON();writes.push(body);assigned=body.assign;
    await route.fulfill({json:{status:'applied'}});
  });
  await page.goto('/zhezhemon/processing');await page.locator('article').first().getByRole('button',{name:/Відкрити картку:/}).click();
  const panel=page.getByRole('dialog'),cancelledRow=panel.getByRole('row').filter({hasText:'Закупка #10'}),
    withdrawnRow=panel.getByRole('row').filter({hasText:'Прибрано з ERP'});
  await expect(cancelledRow.getByRole('button',{name:'Прив’язати до цієї картки'})).toBeEnabled();
  await expect(withdrawnRow.getByRole('button')).toHaveCount(0);
  await cancelledRow.getByRole('button',{name:'Прив’язати до цієї картки'}).click();
  await expect(cancelledRow.getByRole('button',{name:'Відв’язати'})).toBeEnabled();
  await expect(panel.getByText('Збережено історію скасованої закупки.',{exact:false})).toBeVisible();
  await expect(panel.getByRole('button',{name:'Повернути в «Нові»'})).toHaveCount(0);
  await expect(panel.getByText('Є підтвердження ERP.',{exact:false})).toHaveCount(0);
  expect(writes[0]).toMatchObject({key:'cancelled-order',assign:true,version:3});
  await page.screenshot({path:'node_modules/.cache/cancelled-purchase-history.png'});
  await cancelledRow.getByRole('button',{name:'Відв’язати'}).click();
  await expect(panel.getByText('Результату немає',{exact:true})).toBeVisible();
  expect(writes[1]).toMatchObject({key:'cancelled-order',assign:false,version:2});
});

for(const width of [320,850,1024])test(`queue navigation fits ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:700});await fixtures(page);await page.goto('/zhezhemon/processing');await expect(page.locator('article')).toHaveCount(4);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await expect(page.getByRole('navigation',{name:'Розділи ZheZhemon'}).getByRole('link',{name:'Нові',exact:true})).toHaveAttribute('aria-current','page');
});
