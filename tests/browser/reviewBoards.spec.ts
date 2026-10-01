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

async function fixtures(page:any,photos:any[]=[]) {
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
  await page.route('**/api/review/boards?**',async(route:any)=>{
    const url=new URL(route.request().url());
    if(url.searchParams.get('id')){await route.fulfill({json:{...detail,...captured(photos),photos}});return;}
    const stage=url.searchParams.get('stage') ?? 'new',rows=url.searchParams.get('link')==='none'?[]:Array.from({length:4},(_,i)=>({...card,id:i===0?id:`33333333-3333-4333-8333-${String(i).padStart(12,'0')}`,title:`${card.title} ${i+1}`,stage,...(stage==='processed'?{outcome:'funds'}:{})}));
    await route.fulfill({json:{pending:stage==='new'?rows.length:0,columns:{new:{count:stage==='new'?rows.length:0,cards:stage==='new'?rows:[]},processed:{count:stage==='processed'?rows.length:0,cards:stage==='processed'?rows:[]}}}});
  });
  await page.route('**/api/review/contexts',async(route:any)=>route.fulfill({json:{id,kind:'delivery',link,delivery_id:delivery,event_id:id,listing_version:0,result_version:0,snapshot_id:id,live:{listing_version:0}}}));
  await page.route('**/api/review/commands',async(route:any)=>{commands.push(route.request().postDataJSON());await route.fulfill({json:{status:'applied'}});});
  return commands;
}


test('one new queue has two desktop columns and no scoring or manual bought',async({page})=>{
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
test('journal has processed cards with editing through the panel',async({page})=>{
  await fixtures(page);await page.goto('/zhezhemon/processed');
  await expect(page.getByRole('heading',{name:/Журнал оброблених/})).toBeVisible();
  await expect(page.locator('article')).toHaveCount(4);
  await expect(page.getByRole('group',{name:/Результат:/})).toHaveCount(0);
  await page.getByRole('button',{name:/ThinkPad/}).first().click();
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
for(const width of [320,850,1024])test(`queue navigation fits ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:700});await fixtures(page);await page.goto('/zhezhemon/processing');await expect(page.locator('article')).toHaveCount(4);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await expect(page.getByRole('navigation',{name:'Розділи ZheZhemon'}).getByRole('link',{name:'Нові',exact:true})).toHaveAttribute('aria-current','page');
});
