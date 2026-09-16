import {test,expect} from '@playwright/test';
import {createHmac} from 'node:crypto';
import {capturedListingView} from '../../lib/capturedListing';
import {sanitizeDescription} from '../../lib/sanitizeDescription';

const id='11111111-1111-4111-8111-111111111111', delivery='22222222-2222-4222-8222-222222222222';
const link='https://www.ebay.com/itm/123', at='2026-09-11T08:00:00+00:00';
const card={id,board:'review',link,card_at:at,stage:'new',delivery_id:delivery,review_id:id,event_id:id,search_id:1,search_name:'Lenovo',kind:'first_seen',channel:'main',condition_id:'1000',title:'ThinkPad T14 — тестовий лот',price:'202.30',currency:'USD',outcome:null,first_reaction_at:null,outcome_at:null,resolution_kind:null,sent_at:at,missing:6,hidden:false,hidden_until:null,favorite:false,stock_blocked:false,stock_snapshot_id:id,stock_observed_at:at,stock_quantity:{value:2,relation:'approx'}};
const assessment:any={id,link,origin_delivery_id:delivery,version:0,submitted_at:null,revision_opened_at:null,decision_reaction_id:null,decision_note:null,evaluation_snapshot_id:id,rubric_version:1,photo_notes:{}};
for(const key of ['title','shop','aspects','description','photos','price_shipping']){assessment[`score_${key}`]=null;assessment[`note_${key}`]=null;}
const view={deliveryId:delivery,eventId:id,dispatchId:id,link,channel:'main',kind:'first_seen',sentAt:at,stateVersion:0,searchId:1,searchExists:true,searchName:'Lenovo',firstReactionAt:null,outcome:null,outcomeAt:null,resolutionKind:null,currentPrice:202.3,
  live:{hidden:false,hiddenUntil:null,hidePrice:null,favorite:false,bannedInSearch:false,stockBlocked:false,liked:false,listingVersion:0}};
const availability=[{estimatedAvailabilityStatus:'IN_STOCK',deliveryOptions:['SHIP_TO_HOME'],estimatedAvailableQuantity:2}];
const aspects=Array.from({length:10},(_,i)=>({name:`Параметр ${i+1}`,value:i?`значення ${i+1}`:'32 GB'}));
const hostileDescription='<script>window.bad=true</script><p style="color:red" onclick="window.bad=true">Текст продавця</p><img src="https://tracker.example/pixel.gif">'+'<p>Довгий абзац опису. </p>'.repeat(40);
const snapshot={id,observed_at:at,source:'get_item',normalized_payload:{title:card.title,price:'200.10',shipping_cost:'2.20',total_price:'202.30',currency:'USD',shipping_source:'response',itemWebUrl:link,estimatedAvailabilities:availability},
  raw_payload:{seller:{username:'seller',feedbackScore:4695,feedbackPercentage:'99.9'},localizedAspects:aspects,description:hostileDescription,estimatedAvailabilities:availability}};
const search={minprice:100,maxprice:500};
// Same server-side projection as readCard, so the UI fixture cannot drift from the real contract.
const captured=(photos:unknown[])=>{const view=capturedListingView({snapshot,search,photoCount:photos.length,conditionId:card.condition_id});return {captured:{...view,descriptionSource:null},description:sanitizeDescription(view.descriptionSource)};};
const detail={card,view,review:assessment,snapshot,photos:[],search,history:{reactions:[],deliveries:[{id:delivery,telegram_sent_at:at,channel:'main'}],events:[]},revisions:[],missingSources:[],...captured([])};

test.beforeEach(async({context})=>{
  const now=Math.floor(Date.now()/1000), payload=Buffer.from(JSON.stringify({v:1,sub:'buyer',iat:now,exp:now+14*86400,nonce:'ui-test'})).toString('base64url');
  const signature=createHmac('sha256','local-stage-five-test-secret-not-for-production').update(payload).digest('base64url');
  await context.addCookies([{name:'review_test_session',value:`${payload}.${signature}`,domain:'127.0.0.1',path:'/',httpOnly:true,sameSite:'Strict'}]);
});

async function fixtures(page:any,photos:any[]=[]) {
  const commands:any[]=[]; let version=0;
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
    const url=new URL(route.request().url()), board=url.searchParams.get('tab');
    if(url.searchParams.get('id')){await route.fulfill({json:{...detail,...captured(photos),photos,review:{...assessment,version},card:{...card,board,id:board==='notifications'?delivery:id}}});return;}
    const rows=url.searchParams.get('link')==='none'?[]:[{...card,board,id:board==='notifications'?delivery:id}];
    await route.fulfill({json:{pending:rows.length,columns:{new:{count:rows.length,cards:rows},working:{count:0,cards:[]},done:{count:0,cards:[]}}}});
  });
  await page.route('**/api/review/contexts',async(route:any)=>route.fulfill({json:{id,kind:'delivery',link,delivery_id:delivery,event_id:id,listing_version:0,result_version:0,snapshot_id:id,live:{listing_version:0}}}));
  await page.route('**/api/review/commands',async(route:any)=>{commands.push(route.request().postDataJSON());await route.fulfill({json:{status:'applied'}});});
  await page.route('**/api/review/assessments',async(route:any)=>{commands.push(route.request().postDataJSON());version++;await route.fulfill({json:{status:'applied',version}});});
  await page.route('**/api/review/reporting?**',async(route:any)=>route.fulfill({json:{rows:[],next:null,total:0}}));
  return commands;
}

test('horizontal navigation and two tabs; independent filters survive switching and reload',async({page})=>{
  await fixtures(page);await page.goto('/zhezhemon/processing?tab=review');
  await expect(page.getByRole('navigation',{name:'Розділи ZheZhemon'})).toBeVisible();
  await expect(page.locator('aside')).toHaveCount(0);
  await expect(page.getByRole('tab')).toHaveCount(2);
  await expect(page.getByRole('button',{name:/ThinkPad/})).toBeVisible();
  await expect(page.getByRole('button',{name:/ThinkPad/})).toContainText('📦 ≈2 шт. · за знімком');
  await page.screenshot({path:'node_modules/.cache/boards-overview.png'});
  await page.getByRole('button',{name:'Фільтри',exact:true}).click();
  await page.getByLabel('Лінк або заголовок').fill('none');await page.getByRole('button',{name:'Застосувати'}).click();
  await expect(page.getByRole('button',{name:/ThinkPad/})).toHaveCount(0);
  await page.getByRole('tab',{name:/Усі сповіщення/}).click();await expect(page.getByRole('button',{name:/ThinkPad/})).toBeVisible();
  await expect(page.getByLabel('Лінк або заголовок')).toHaveValue('');
  await page.getByRole('tab',{name:/Оцінка оголошень/}).click();await expect(page.getByLabel('Лінк або заголовок')).toHaveValue('none');
  await page.reload();await page.getByRole('button',{name:/Фільтри/}).click();await expect(page.getByLabel('Лінк або заголовок')).toHaveValue('none');
});

test('deep-linked review opens safe snapshot, six scores, draft and close return to filters',async({page})=>{
  const commands=await fixtures(page);await page.goto(`/zhezhemon/processing?tab=review&review=${id}&review.search=1`);
  const panel=page.getByRole('dialog');await expect(panel).toBeVisible();
  await expect(panel.getByText('📦 В наявності · ≈2 шт.',{exact:true})).toBeVisible();
  await expect(panel.getByText(/Знімок: детальні дані eBay.*Історичні дані/)).toBeVisible();
  await expect(panel.getByRole('heading',{name:/Оцінка за шістьма/})).toBeVisible();
  await expect(panel.getByRole('combobox',{name:/: бал/})).toHaveCount(6);
  await expect(panel.getByText('Текст продавця',{exact:true})).toBeVisible();
  await expect(panel.getByText('<script>window.bad=true</script>',{exact:false})).not.toBeVisible();
  expect(await page.evaluate(()=>Boolean((window as any).bad))).toBe(false);
  await panel.getByLabel('Заголовок: бал').selectOption('4');
  await panel.getByRole('button',{name:'Зберегти чернетку'}).click();
  await expect(panel.getByRole('heading',{name:/v1/})).toBeVisible();
  expect(commands[0].payload.score_title).toBe(4);expect(commands[0].action).toBe('draft');
  await page.screenshot({path:'node_modules/.cache/boards-desktop.png'});
  await panel.getByRole('button',{name:'Закрити ×'}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page).toHaveURL(/review.search=1/);
});

test('operational card has no scoring form; direct action keeps delivery context',async({page})=>{
  const commands=await fixtures(page);await page.goto(`/zhezhemon/processing?tab=notifications&delivery=${delivery}`);
  const panel=page.getByRole('dialog');await expect(panel).toBeVisible();
  await expect(panel.getByRole('combobox',{name:/: бал/})).toHaveCount(0);
  await panel.getByRole('button',{name:'Приховати до подешевшання'}).click();
  await expect.poll(()=>commands.length).toBe(1);expect(commands[0].contextId).toBe(id);expect(commands[0].action).toBe('hide');
});

test('mobile card is full-screen and unsaved close requires confirmation',async({page})=>{
  await page.setViewportSize({width:390,height:844});await fixtures(page);
  await page.goto(`/zhezhemon/processing?tab=review&review=${id}`);
  const panel=page.getByRole('dialog');await expect(panel).toBeVisible();
  const box=await panel.boundingBox();expect(box!.width).toBe(390);
  await panel.getByLabel('Заголовок: бал').selectOption('5');
  page.once('dialog',d=>d.dismiss());await panel.getByRole('button',{name:'Закрити ×'}).click();await expect(panel).toBeVisible();
  await page.screenshot({path:'node_modules/.cache/boards-mobile.png'});
  page.once('dialog',d=>d.accept());await panel.getByRole('button',{name:'Закрити ×'}).click();await expect(panel).toHaveCount(0);
});

test('catalog images still render through the real local Next optimizer',async({page,request})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.stack??error.message));
  await fixtures(page);
  await page.route('http://127.0.0.1:9/rest/v1/items?**',route=>route.fulfill({json:[{
    id:123,search_parameter_id:1,title:'Dependency smoke item',model:'T14',price:200,shipping_cost:2,
    link,seller_name:'Local fixture',feedback_score:50,feedback_percentage:99,image_url:'No image',
    hidden:false,liked:false,condition:'New',more_aspects:[],scraped_links:{count:1,favorite:false},
  }]}));
  await page.goto('/zhezhemon');
  const photo=page.getByRole('img',{name:'Dependency smoke item',exact:true});
  await expect.poll(async()=>errors.length ? errors.join('\n') : await photo.count()).toBe(1);
  await expect(photo).toBeVisible();
  await expect(photo).toHaveAttribute('src',/\/_next\/image\?/);
  await expect.poll(()=>photo.evaluate((img:HTMLImageElement)=>img.naturalWidth)).toBeGreaterThan(0);
  const optimized=await request.get('/_next/image?url=%2Fimages%2Fplaceholder.png&w=128&q=75',{headers:{Accept:'image/webp'}});
  expect(optimized.status()).toBe(200);
  expect(optimized.headers()['content-type']).toContain('image/webp');
  // Invalid remote host is rejected by the allowlist before any remote fetch.
  const rejected=await request.get('/_next/image?url=https%3A%2F%2Fexample.invalid%2Fx.jpg&w=128&q=75');
  expect(rejected.status()).toBe(400);
});

test('existing Recharts graph renders two fixture series after dependency updates',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await fixtures(page);
  await page.route('http://127.0.0.1:9/rest/v1/zzk_params?**',route=>route.fulfill({json:[{id:1,keywords:[],stat_keys:[],minuskeys:[],minususers:[]}]}));
  await page.route('http://127.0.0.1:9/rest/v1/rpc/global_keyword_stats_by_day',route=>route.fulfill({json:[
    {day:'2026-09-10T00:00:00Z',keyword:'laptop',count:2},
    {day:'2026-09-11T00:00:00Z',keyword:'laptop',count:4},
    {day:'2026-09-10T00:00:00Z',keyword:'phone',count:1},
    {day:'2026-09-11T00:00:00Z',keyword:'phone',count:3},
  ]}));
  await page.goto('/zhezheka');
  await expect(page.getByRole('heading',{name:/Global keywords stats/})).toBeVisible();
  await expect(page.locator('path.recharts-line-curve')).toHaveCount(2);
  await expect(page.locator('.recharts-legend-item-text').filter({hasText:'laptop'})).toBeVisible();
  expect(errors).toEqual([]);
});

test('catalog and shop consumers can remount without duplicate subscriptions',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await fixtures(page);
  for(const path of ['/shop','/zhezhemon','/shop','/zhezhemon']){
    await page.goto(path);
    await expect(page.locator('aside')).toHaveCount(1);
    await expect(page.getByRole('heading',{name:'Add New Search',exact:true})).toBeVisible();
  }
  await page.getByRole('navigation',{name:'Розділи ZheZhemon'}).getByRole('link',{name:'Опрацювання'}).click();
  await expect(page.getByRole('tab')).toHaveCount(2);
  await page.getByRole('navigation',{name:'Розділи ZheZhemon'}).getByRole('link',{name:'Оголошення'}).click();
  await expect(page.getByRole('heading',{name:'Add New Search',exact:true})).toBeVisible();
  expect(errors).toEqual([]);
});

test('URL-only photo failure is explicit and never an archive backlog error',async({page})=>{
  const source='https://i.ebayimg.com/images/url-only-test.jpg';
  await fixtures(page,[{source_url:source,status:'url_only',content_hash:null}]);
  await page.route(source,route=>route.fulfill({status:404,body:''}));
  await page.goto(`/zhezhemon/processing?tab=review&review=${id}`);
  const panel=page.getByRole('dialog');
  await panel.getByRole('heading',{name:'Фото оголошення · 1'}).scrollIntoViewIfNeeded();
  await expect(panel.getByText('Фото недоступне за збереженим URL.')).toBeVisible();
  await expect(panel.getByRole('link',{name:'Відкрити збережений URL ↗'})).toHaveAttribute('href',source);
  await expect(panel.getByText('Архів: pending')).toHaveCount(0);
  await expect(panel.getByLabel('Нотатка до фото 1 (необов’язково)')).toHaveCount(1);
});

test('real endpoints require auth, same origin and rollout flag (no mocks)',async({request})=>{
  expect((await request.get('/api/review/boards')).status()).toBe(401);
  expect((await request.post('/api/review/assessments',{data:{}})).status()).toBe(401);
  expect((await request.get('/api/review/reporting?report=statistics')).status()).toBe(401);
  expect((await request.get('/api/review/realtime')).status()).toBe(401);
  expect((await request.post('/api/review/reporting',{data:{}})).status()).toBe(401);
  const auth=await request.post('/api/auth',{headers:{Origin:'http://127.0.0.1:3217'},data:{password:'local-test-password'}});
  expect(auth.status()).toBe(200);
  expect((await request.get('/api/review/boards')).status()).toBe(503);
  expect((await request.post('/api/review/assessments',{headers:{Origin:'https://foreign.invalid'},data:{}})).status()).toBe(403);
  expect((await request.post('/api/review/assessments',{headers:{Origin:'http://127.0.0.1:3217'},data:{}})).status()).toBe(503);
  expect((await request.get('/api/review/reporting?report=statistics')).status()).toBe(503);
  expect((await request.get('/api/review/realtime')).status()).toBe(503);
  expect((await request.post('/api/review/reporting',{headers:{Origin:'https://foreign.invalid'},data:{}})).status()).toBe(403);
  expect((await request.post('/api/review/reporting',{headers:{Origin:'http://127.0.0.1:3217'},data:{}})).status()).toBe(503);
});

test('reporting keeps event filters separate from report type; export downloads verified JSONL',async({page})=>{
  await fixtures(page);
  let manifest:any;const queries:URLSearchParams[]=[];
  await page.route('**/api/review/reporting**',async route=>{
    const req=route.request(),p=new URL(req.url()).searchParams;queries.push(p);
    if(req.method()==='POST'){
      const body=req.postDataJSON();manifest={id:body.id,filters:{},created_at:at,expires_at:at,row_count:2,excluded_count:1};
      return route.fulfill({json:manifest});
    }
    if(p.get('report')==='statistics')return route.fulfill({json:{generatedAt:at,thresholdSeconds:null,summary:{deliveries:2,events:1,triggers:1,links:1,without_attention:0,without_outcome:0,shared:1,event_context:0,direct_samples:1,decision_samples:1,reaction_median_seconds:90,reaction_p90_seconds:90,decision_median_seconds:120,decision_p90_seconds:120,clock_anomalies:0,oldest_pending_seconds:null,missed_deliveries:2,missed_triggers:1,missed_links:1,missed_links_later_bought:0},breakdown:[],reasons:[]}});
    const n=Number(p.get('after'))+1;
    return route.fulfill({json:{manifest,after:n,complete:n===2,rows:[{schemaVersion:1,ordinal:n,assessment:{},features:{},decision:{}}]}});
  });
  await page.goto('/zhezhemon/processing?tab=notifications&notifications.kind=price_drop');
  await page.getByText('Аналітика сповіщень',{exact:true}).click();
  await expect(page.getByText('До першої прямої реакції',{exact:true})).toBeVisible();
  expect(queries.some(p=>p.get('report')==='statistics' && p.get('kind')==='price_drop')).toBe(true);
  await page.screenshot({path:'node_modules/.cache/boards-reporting.png',fullPage:true});
  await page.getByRole('tab',{name:/Оцінка оголошень/}).click();
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Експорт',exact:true}).click();
  const file=await download;expect(file.suggestedFilename()).toMatch(/\.jsonl$/);
  const stream=await file.createReadStream();let text='';for await(const chunk of stream!)text+=chunk.toString();
  const lines=text.trim().split('\n').map(line=>JSON.parse(line));
  expect(lines.map(line=>line.type)).toEqual(['manifest','training_example','training_example','complete']);
  expect(lines.at(-1).rows).toBe(2);
});

test('reaction history loads older rows and stops at the final cursor',async({page})=>{
  await fixtures(page);
  await page.route('**/api/review/reporting?**',async route=>{
    const old=new URL(route.request().url()).searchParams.has('before');
    await route.fulfill({json:{total:2,next:old?null:{at,id},rows:[{id:old?delivery:id,action:old?'older-test-action':'recent-test-action',outcome:null,reason_code:null,note:null,source:'dashboard',received_at:at,delivery_id:delivery,event_id:id,supersedes_reaction_id:null}]}});
  });
  await page.goto(`/zhezhemon/processing?tab=notifications&delivery=${delivery}`);
  await page.getByRole('button',{name:'Старіші дії · ще 50'}).click();
  await expect(page.getByText('older-test-action',{exact:true})).toBeVisible();
  await expect(page.getByText('Історію завантажено повністю.')).toBeVisible();
  await expect(page.getByRole('button',{name:'Старіші дії · ще 50'})).toHaveCount(0);
});

test('incomplete export never downloads; retry retains its manifest id',async({page})=>{
  await fixtures(page);const ids:string[]=[];let manifest:any,valid=false,downloads=0;
  page.on('download',()=>downloads++);
  await page.route('**/api/review/reporting**',async route=>{
    if(route.request().method()==='POST'){
      const body=route.request().postDataJSON();ids.push(body.id);
      manifest={id:body.id,filters:{},created_at:at,expires_at:at,row_count:1,excluded_count:0};
      return route.fulfill({json:manifest});
    }
    return route.fulfill({json:{manifest,after:valid?1:0,complete:true,rows:valid?[{schemaVersion:1,ordinal:1,assessment:{},features:{},decision:{}}]:[]}});
  });
  await page.setViewportSize({width:390,height:844});
  await page.goto('/zhezhemon/processing?tab=review');
  await page.getByRole('button',{name:'Експорт',exact:true}).click();
  await expect(page.getByRole('alert').filter({hasText:'Файл не збережено'})).toBeVisible();expect(downloads).toBe(0);
  await page.screenshot({path:'node_modules/.cache/boards-export-mobile.png',fullPage:true});
  valid=true;const download=page.waitForEvent('download');
  await page.getByRole('button',{name:'Повторити експорт',exact:true}).click();await download;
  expect(ids).toHaveLength(2);expect(ids[0]).toBe(ids[1]);
  await page.getByRole('button',{name:'Про експорт навчальних оцінок'}).click();
  await expect(page.getByText(/Уся вибірка за активними фільтрами/)).toBeVisible();
  await page.getByRole('button',{name:'Новий зріз',exact:true}).click();
  await page.keyboard.press('Escape');
  const fresh=page.waitForEvent('download');await page.getByRole('button',{name:'Експорт',exact:true}).click();await fresh;
  expect(ids[2]).not.toBe(ids[1]);
});

for(const width of [320,375,390,850,1024,1440]) {
  test(`compact navigation and tabs fit ${width}px without page overflow`,async({page})=>{
    await page.setViewportSize({width,height:700});await fixtures(page);
    await page.route('**/api/review/boards?**',route=>route.fulfill({json:{pending:123456789,columns:{new:{count:0,cards:[]},working:{count:0,cards:[]},done:{count:0,cards:[]}}}}));
    await page.goto('/zhezhemon/processing?review.link=none');
    const nav=page.getByRole('navigation',{name:'Розділи ZheZhemon'});
    await expect(nav).toBeVisible();
    await expect(nav.getByRole('link',{name:'Опрацювання'})).toHaveAttribute('aria-current','page');
    const navBox=(await nav.boundingBox())!;
    if(width>=1024)expect(navBox.y).toBeLessThan(65);else expect(navBox.y).toBe(65);
    const tabs=page.getByRole('tablist');
    expect(await tabs.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
    expect(await nav.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await expect(page.getByLabel('Лінк або заголовок')).toBeHidden();
    const filters=page.getByRole('button',{name:'Фільтри · 1',exact:true});
    await filters.click();await expect(filters).toHaveAttribute('aria-expanded','true');
    await expect(page.getByLabel('Лінк або заголовок')).toHaveValue('none');
    await filters.click();await expect(page.getByLabel('Лінк або заголовок')).toBeHidden();
    await expect(page).toHaveURL(/review.link=none/);
    await page.getByRole('button',{name:'Про експорт навчальних оцінок'}).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText(/Уся вибірка за активними фільтрами/)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByText(/Уся вибірка за активними фільтрами/)).toBeHidden();
    if(width===320 || width===1024)await page.screenshot({path:`node_modules/.cache/boards-compact-${width}.png`});
  });
}

test('desktop columns fill a short viewport and retain independent scroll across cards, tabs and refresh',async({page})=>{
  await page.setViewportSize({width:1280,height:600});await fixtures(page);
  await page.route('**/api/review/boards?**',async route=>{
    const p=new URL(route.request().url()).searchParams,board=p.get('tab');
    if(p.get('id'))return route.fulfill({json:detail});
    const rows=Array.from({length:20},(_,n)=>({...card,id:n===0?id:`row-${n}`,board,title:`Card ${n} — ${card.title}`}));
    await route.fulfill({json:{pending:40,columns:{new:{count:20,cards:rows},working:{count:20,cards:rows},done:{count:0,cards:[]}}}});
  });
  await page.goto('/zhezhemon/processing');
  const columns=page.getByRole('tabpanel'),stack=page.locator('[data-stage="new"] > div'),other=page.locator('[data-stage="working"] > div');
  await expect(page.getByRole('button',{name:/Card 0/}).first()).toBeVisible();
  const box=(await columns.boundingBox())!;expect(box.y).toBeLessThan(150);expect(box.y+box.height).toBeGreaterThan(575);expect(box.y+box.height).toBeLessThanOrEqual(600);
  expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight)).toBe(true);
  await stack.evaluate(el=>el.scrollTop=350);await expect.poll(()=>stack.evaluate(el=>el.scrollTop)).toBe(350);
  expect(await other.evaluate(el=>el.scrollTop)).toBe(0);
  // Use a stable deep-link ID while the scroller is away from its start.
  await stack.locator('button').nth(2).click();await expect(page.getByRole('dialog')).toBeVisible();
  const before=await stack.evaluate(el=>el.scrollTop);
  await page.getByRole('button',{name:'Закрити ×'}).click();
  await expect.poll(()=>stack.evaluate(el=>el.scrollTop)).toBe(before);
  await page.getByRole('tab',{name:/Усі сповіщення/}).click();await other.evaluate(el=>el.scrollTop=200);
  await page.getByRole('tab',{name:/Оцінка оголошень/}).click();
  await expect.poll(()=>stack.evaluate(el=>el.scrollTop)).toBe(before);
  await page.getByRole('button',{name:'Оновити',exact:true}).click();await expect(page.getByRole('button',{name:'Оновити',exact:true})).toBeEnabled();
  await expect.poll(()=>stack.evaluate(el=>el.scrollTop)).toBe(before);
  await page.getByRole('button',{name:'Фільтри',exact:true}).click();
  const expanded=(await columns.boundingBox())!;expect(expanded.height).toBeGreaterThan(250);expect(expanded.y+expanded.height).toBeLessThanOrEqual(600);
  expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight)).toBe(true);
});

test('captured listing data reads as facts: seller, aspects, safe description, technical block, no external calls',async({page,context})=>{
  await context.grantPermissions(['clipboard-read','clipboard-write']);
  const external:string[]=[];
  page.on('request',r=>{const u=r.url();if(!u.startsWith('http://127.0.0.1:3217')&&!u.startsWith('http://127.0.0.1:9'))external.push(u);});
  await fixtures(page,[{source_url:'https://i.ebayimg.com/images/a.jpg',status:'url_only',content_hash:null},{source_url:'https://i.ebayimg.com/images/b.jpg',status:'url_only',content_hash:null}]);
  await page.route('https://i.ebayimg.com/**',route=>route.fulfill({status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==','base64')}));
  await page.goto(`/zhezhemon/processing?tab=review&review=${id}`);
  const panel=page.getByRole('dialog');await expect(panel).toBeVisible();
  const data=panel.locator('#captured-data');
  await expect(data.getByRole('heading',{name:'Дані оголошення на момент повідомлення'})).toBeVisible();
  await data.getByRole('heading',{name:'Дані оголошення на момент повідомлення'}).scrollIntoViewIfNeeded();await page.screenshot({path:'node_modules/.cache/card-captured-top.png'});
  await expect(data.getByText(/^seller · 99,9% позитивних · 4\s695 оцінок$/)).toBeVisible();
  await expect(data.getByText('Стан: New (1000)')).toBeVisible();
  await expect(data.getByText('$200.10 + $2.20 доставка = $202.30')).toBeVisible();
  await expect(data.getByText('Коридор пошуку: $100.00–$500.00')).toBeVisible();
  await expect(data.locator('dl dt')).toHaveCount(8);
  await data.getByRole('button',{name:'Показати всі 10'}).click();
  await expect(data.locator('dl dt')).toHaveCount(10);await expect(data.locator('dd',{hasText:'32 GB'})).toBeVisible();
  const expand=data.getByRole('button',{name:'Розгорнути весь опис'});
  await expect(expand).toHaveAttribute('aria-expanded','false');
  const collapsed=data.locator('[data-collapsed=true]');
  const before=(await collapsed.boundingBox())!.height;
  await expand.click();await expect(data.getByRole('button',{name:'Згорнути опис'})).toHaveAttribute('aria-expanded','true');
  await expect(collapsed).toHaveCount(0);
  expect((await data.locator('#captured-description ~ div').first().boundingBox())!.height).toBeGreaterThan(before);
  await expect(data.getByRole('heading',{name:'Фото оголошення · 2'})).toBeVisible();
  await expect(data.getByRole('img',{name:'Фото 2 з 2 · ThinkPad T14 — тестовий лот'})).toBeVisible();
  await expect(data.getByText('збережено URL, власна копія не потрібна')).toHaveCount(0);
  await expect(data.locator('pre:visible')).toHaveCount(0);
  const technical=data.locator('details').filter({hasText:'Технічні дані'}).first();
  await technical.locator('summary').first().click();
  const raw=technical.locator('details').filter({hasText:'Сирий payload eBay'});
  await raw.locator('summary').click();
  await expect(raw.locator('pre')).toContainText('window.bad=true');
  await raw.getByRole('button',{name:'Копіювати JSON'}).click();
  await expect(raw.getByText('Скопійовано')).toBeVisible();
  expect(JSON.parse(await page.evaluate(()=>navigator.clipboard.readText())).seller.username).toBe('seller');
  expect(await page.evaluate(()=>Boolean((window as any).bad))).toBe(false);
  expect(external.filter(u=>!u.startsWith('https://i.ebayimg.com/'))).toEqual([]);
  await page.screenshot({path:'node_modules/.cache/card-captured-data.png'});
});

test('captured data has no horizontal overflow on a 320px phone',async({page})=>{
  await page.setViewportSize({width:320,height:700});await fixtures(page);
  await page.goto(`/zhezhemon/processing?tab=review&review=${id}`);
  const panel=page.getByRole('dialog');await expect(panel).toBeVisible();
  await panel.getByRole('button',{name:'Показати всі 10'}).click();
  await panel.getByRole('button',{name:'Розгорнути весь опис'}).click();
  const body=panel.locator('#captured-data');
  expect(await body.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
  await page.screenshot({path:'node_modules/.cache/card-captured-320.png',fullPage:false});
});

test('card header stays visible while content scrolls and keyboard focus returns on close',async({page})=>{
  await page.setViewportSize({width:1280,height:650});await fixtures(page);
  await page.route(`**/api/review/boards?tab=review&id=${id}`,route=>route.fulfill({json:{...detail,card:{...card,title:'Дуже довга назва товару '.repeat(30)}}}));
  await page.goto('/zhezhemon/processing');
  const tile=page.getByRole('button',{name:/ThinkPad/});await tile.click();
  const panel=page.getByRole('dialog'),close=panel.getByRole('button',{name:'Закрити ×'}),refresh=panel.getByRole('button',{name:'Оновити картку'});
  await expect(close).toBeFocused();const before=(await close.boundingBox())!;
  await panel.getByLabel('Заголовок: бал').selectOption('5');
  expect((await close.boundingBox())!.y).toBe(before.y);await expect(refresh).toBeInViewport();
  await refresh.click();await expect(panel.getByLabel('Заголовок: бал')).toHaveValue('5');
  page.once('dialog',d=>d.dismiss());await page.keyboard.press('Escape');await expect(panel).toBeVisible();
  page.once('dialog',d=>d.accept());await close.click();await expect(panel).toHaveCount(0);
  await expect(tile).toBeFocused();
});

test('realtime coalesces bursts, catches visibility gaps and preserves a dirty assessment',async({page})=>{
  let boardReads=0,detailVersion=0,hold=false,held=0,release=()=>{};let gate:Promise<void>=Promise.resolve();
  await fixtures(page)
  await page.route('**/api/review/boards?**',async route=>{
    boardReads++;const p=new URL(route.request().url()).searchParams,board=p.get('tab');
    if(hold){held++;await gate}
    if(p.get('id'))return route.fulfill({json:{...detail,review:{...assessment,version:detailVersion,score_title:detailVersion?3:null},card:{...card,board,id:board==='notifications'?delivery:id}}});
    const rows=[{...card,board,id:board==='notifications'?delivery:id}];
    await route.fulfill({json:{pending:1,columns:{new:{count:1,cards:rows},working:{count:0,cards:[]},done:{count:0,cards:[]}}}});
  });
  await page.goto(`/zhezhemon/processing?tab=review&review=${id}`);
  await expect(page.getByText('Наживо',{exact:true})).toBeVisible();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.waitForTimeout(1000);let baseline=boardReads;
  await page.evaluate(()=>{const s=(window as any).__reviewRealtime.at(-1);s.emit('invalidate');s.emit('invalidate');s.emit('invalidate')});
  await expect.poll(()=>boardReads).toBe(baseline+3);
  await page.waitForTimeout(500);expect(boardReads).toBe(baseline+3);

  baseline=boardReads;gate=new Promise<void>(resolve=>{release=resolve});hold=true;
  await page.evaluate(()=>{(window as any).__reviewRealtime.at(-1).emit('invalidate')});
  await expect.poll(()=>held).toBe(3);
  await page.evaluate(()=>{(window as any).__reviewRealtime.at(-1).emit('invalidate')});
  hold=false;release();await expect.poll(()=>boardReads).toBe(baseline+6);
  await page.waitForTimeout(500);expect(boardReads).toBe(baseline+6);

  const score=page.getByRole('dialog').getByLabel('Заголовок: бал');await score.selectOption('5');detailVersion=1;
  await page.evaluate(()=>{(window as any).__reviewRealtime.at(-1).emit('invalidate')});
  await expect(page.getByText('Дані змінилися.',{exact:false})).toBeVisible();
  await expect(score).toHaveValue('5');
  page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Оновити й відкинути чернетку'}).click();
  await expect(page.getByRole('dialog').getByLabel('Заголовок: бал')).toHaveValue('3');

  await page.evaluate(()=>Object.defineProperty(document,'visibilityState',{value:'hidden',configurable:true}));
  const hiddenBaseline=boardReads;await page.evaluate(()=>{(window as any).__reviewRealtime.at(-1).emit('invalidate')});await page.waitForTimeout(500);expect(boardReads).toBe(hiddenBaseline);
  await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{value:'visible',configurable:true});document.dispatchEvent(new Event('visibilitychange'))});
  await expect.poll(()=>boardReads).toBeGreaterThan(hiddenBaseline);
  await page.getByRole('button',{name:'Закрити ×'}).click();
  await page.getByRole('button',{name:/ZheZhemon/}).click();
  await page.getByRole('link',{name:'Shop',exact:true}).click();await expect(page).toHaveURL(/\/shop$/);
  await expect.poll(()=>page.evaluate(()=>(window as any).__reviewRealtime[0]?.closed)).toBe(true);
});

test('realtime fallback polls with backoff only until the stream recovers',async({page})=>{
  let boardReads=0;await fixtures(page);
  await page.route('**/api/review/boards?**',async route=>{
    boardReads++;const board=new URL(route.request().url()).searchParams.get('tab');
    await route.fulfill({json:{pending:1,columns:{new:{count:1,cards:[{...card,board,id:board==='notifications'?delivery:id}]},working:{count:0,cards:[]},done:{count:0,cards:[]}}}});
  });
  await page.goto('/zhezhemon/processing?tab=review');await expect(page.getByText('Наживо',{exact:true})).toBeVisible();
  await page.waitForTimeout(1000);await page.clock.install();let baseline=boardReads;
  await page.evaluate(()=>{(window as any).__reviewRealtime.at(-1).onerror?.()});
  await expect(page.getByText('Резервне оновлення',{exact:true})).toBeVisible();
  await page.clock.fastForward(60250);await expect.poll(()=>boardReads).toBe(baseline+2);
  await page.evaluate(()=>{(window as any).__reviewRealtime.at(-1).emit('ready')});await page.clock.fastForward(250);
  await expect(page.getByText('Наживо',{exact:true})).toBeVisible();await expect.poll(()=>boardReads).toBe(baseline+4);
  baseline=boardReads;await page.clock.fastForward(300000);await page.waitForTimeout(100);expect(boardReads).toBe(baseline);
});

test('expanded analytics and filters leave usable columns in a low desktop window',async({page})=>{
  await page.setViewportSize({width:1280,height:480});await fixtures(page);
  await page.route('**/api/review/reporting?**',route=>route.fulfill({json:{generatedAt:at,thresholdSeconds:null,summary:{deliveries:2},breakdown:[],reasons:[]}}));
  await page.goto('/zhezhemon/processing?tab=notifications');
  await page.getByRole('button',{name:'Фільтри',exact:true}).click();
  await page.getByText('Аналітика сповіщень',{exact:true}).click();
  await expect(page.getByText('До першої прямої реакції',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Перерахувати'})).toHaveAccessibleDescription(/eBay не опитується/);
  const box=(await page.getByRole('tabpanel').boundingBox())!;
  expect(box.height).toBeGreaterThan(170);expect(box.y+box.height).toBeLessThanOrEqual(480);
  await page.getByRole('button',{name:'Перерахувати'}).scrollIntoViewIfNeeded();
  await expect(page.getByRole('tab',{name:/Усі сповіщення/})).toBeInViewport();
  await expect(page.getByRole('button',{name:'Фільтри',exact:true})).toBeInViewport();
  expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight)).toBe(true);
  await page.screenshot({path:'node_modules/.cache/boards-low-desktop.png'});
});

test('catalog lists scroll independently and mobile search panel stays below navigation',async({page})=>{
  await page.setViewportSize({width:1280,height:650});await fixtures(page);
  await page.route('http://127.0.0.1:9/rest/v1/items?**',route=>route.fulfill({json:Array.from({length:30},(_,n)=>({
    id:n,search_parameter_id:1,title:`Каталог ${n} — довга назва товару для перевірки верстки`,model:'T14',price:200,shipping_cost:2,
    link:`https://www.ebay.com/itm/${n}`,seller_name:'Local fixture',feedback_score:50,feedback_percentage:99,image_url:'No image',
    hidden:false,liked:false,condition:'New',more_aspects:[],scraped_links:{count:1,favorite:false},
  }))}));
  await page.route('http://127.0.0.1:9/rest/v1/searchparameters?**',route=>route.fulfill({json:Array.from({length:40},(_,n)=>({id:n+1,keywords:`Тестовий пошук ${n}`,condition:1000,rate:60}))}));
  await page.goto('/zhezhemon');
  await expect(page.getByRole('img',{name:/Каталог 0/})).toBeVisible();
  const aside=page.getByRole('complementary',{name:'Пошуки ZheZhemon'}),main=page.getByRole('main');
  await expect(aside.getByRole('link')).toHaveCount(41);
  await aside.evaluate(el=>el.scrollTop=200);await main.evaluate(el=>el.scrollTop=300);
  expect(await aside.evaluate(el=>el.scrollTop)).toBe(200);expect(await main.evaluate(el=>el.scrollTop)).toBe(300);
  expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight && document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'node_modules/.cache/catalog-desktop-scroll.png'});
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'Пошуки',exact:true}).click();
  await expect.poll(async()=>(await aside.boundingBox())!.x).toBe(0);
  const navBox=(await page.getByRole('navigation',{name:'Розділи ZheZhemon'}).boundingBox())!,asideBox=(await aside.boundingBox())!;
  expect(asideBox.y).toBe(navBox.y+navBox.height);expect(asideBox.y+asideBox.height).toBe(844-50);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'node_modules/.cache/catalog-mobile-searches.png'});
  await page.getByRole('button',{name:'Пошуки',exact:true}).click();
  await expect(page.getByRole('button',{name:'Пошуки',exact:true})).toHaveAttribute('aria-expanded','false');
});

test('catalog keeps its aside while not-sent is a separate full-width section',async({page})=>{
  await fixtures(page);await page.goto('/zhezhemon');
  await expect(page.locator('aside')).toHaveCount(1);
  await page.getByRole('navigation',{name:'Розділи ZheZhemon'}).getByRole('link',{name:'Не надіслано'}).click();
  await expect(page).toHaveURL(/\/zhezhemon\/not-sent$/,{timeout:30000});
  await expect(page.locator('aside')).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Не надіслано'})).toBeVisible();
  await expect(page.getByRole('tab')).toHaveCount(0);
});
