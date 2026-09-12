import {test,expect} from '@playwright/test';
import {createHmac} from 'node:crypto';

const id='11111111-1111-4111-8111-111111111111', delivery='22222222-2222-4222-8222-222222222222';
const link='https://www.ebay.com/itm/123', at='2026-09-11T08:00:00+00:00';
const card={id,board:'review',link,card_at:at,stage:'new',delivery_id:delivery,review_id:id,event_id:id,search_id:1,search_name:'Lenovo',kind:'first_seen',channel:'main',condition_id:'1000',title:'ThinkPad T14 — тестовий лот',price:'202.30',currency:'USD',outcome:null,first_reaction_at:null,outcome_at:null,resolution_kind:null,sent_at:at,missing:6,hidden:false,hidden_until:null,favorite:false,stock_blocked:false};
const assessment:any={id,link,origin_delivery_id:delivery,version:0,submitted_at:null,revision_opened_at:null,decision_reaction_id:null,decision_note:null,evaluation_snapshot_id:id,rubric_version:1,photo_notes:{}};
for(const key of ['title','shop','aspects','description','photos','price_shipping']){assessment[`score_${key}`]=null;assessment[`note_${key}`]=null;}
const view={deliveryId:delivery,eventId:id,dispatchId:id,link,channel:'main',kind:'first_seen',sentAt:at,stateVersion:0,searchId:1,searchExists:true,searchName:'Lenovo',firstReactionAt:null,outcome:null,outcomeAt:null,resolutionKind:null,currentPrice:202.3,
  live:{hidden:false,hiddenUntil:null,hidePrice:null,favorite:false,bannedInSearch:false,stockBlocked:false,liked:false,listingVersion:0}};
const detail={card,view,review:assessment,snapshot:{id,observed_at:at,source:'get_item',normalized_payload:{title:card.title,price:'200.10',shipping_cost:'2.20',total_price:'202.30',currency:'USD',itemWebUrl:link,estimatedAvailabilities:[{estimatedAvailableQuantity:2}]},raw_payload:{seller:{username:'seller',feedbackScore:500,feedbackPercentage:'99.9'},localizedAspects:[{name:'RAM',value:'32 GB'}],description:'<script>window.bad=true</script>Текст продавця'}},photos:[],search:{minprice:100,maxprice:500},history:{reactions:[],deliveries:[{id:delivery,telegram_sent_at:at,channel:'main'}],events:[]},revisions:[],missingSources:[]};

test.beforeEach(async({context})=>{
  const now=Math.floor(Date.now()/1000), payload=Buffer.from(JSON.stringify({v:1,sub:'buyer',iat:now,exp:now+14*86400,nonce:'ui-test'})).toString('base64url');
  const signature=createHmac('sha256','local-stage-five-test-secret-not-for-production').update(payload).digest('base64url');
  await context.addCookies([{name:'review_test_session',value:`${payload}.${signature}`,domain:'127.0.0.1',path:'/',httpOnly:true,sameSite:'Strict'}]);
});

async function fixtures(page:any,photos:any[]=[]) {
  const commands:any[]=[]; let version=0;
  await page.route('http://127.0.0.1:9/**',(route:any)=>route.fulfill({json:[]}));
  await page.route('**/api/review/boards?**',async(route:any)=>{
    const url=new URL(route.request().url()), board=url.searchParams.get('tab');
    if(url.searchParams.get('id')){await route.fulfill({json:{...detail,photos,review:{...assessment,version},card:{...card,board,id:board==='notifications'?delivery:id}}});return;}
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
  await page.screenshot({path:'node_modules/.cache/boards-overview.png'});
  await page.getByLabel('Лінк або заголовок').fill('none');await page.getByRole('button',{name:'Застосувати'}).click();
  await expect(page.getByRole('button',{name:/ThinkPad/})).toHaveCount(0);
  await page.getByRole('tab',{name:/Усі сповіщення/}).click();await expect(page.getByRole('button',{name:/ThinkPad/})).toBeVisible();
  await expect(page.getByLabel('Лінк або заголовок')).toHaveValue('');
  await page.getByRole('tab',{name:/Оцінка оголошень/}).click();await expect(page.getByLabel('Лінк або заголовок')).toHaveValue('none');
  await page.reload();await expect(page.getByLabel('Лінк або заголовок')).toHaveValue('none');
});

test('deep-linked review opens safe snapshot, six scores, draft and close return to filters',async({page})=>{
  const commands=await fixtures(page);await page.goto(`/zhezhemon/processing?tab=review&review=${id}&review.search=1`);
  const panel=page.getByRole('dialog');await expect(panel).toBeVisible();
  await expect(panel.getByRole('heading',{name:/Оцінка за шістьма/})).toBeVisible();
  await expect(panel.getByRole('combobox',{name:/: бал/})).toHaveCount(6);
  await expect(panel.getByText('<script>window.bad=true</script>Текст продавця',{exact:true})).toBeVisible();
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

test('URL-only photo failure is explicit and never an archive backlog error',async({page})=>{
  const source='https://i.ebayimg.com/images/url-only-test.jpg';
  await fixtures(page,[{source_url:source,status:'url_only',content_hash:null}]);
  await page.route(source,route=>route.fulfill({status:404,body:''}));
  await page.goto(`/zhezhemon/processing?tab=review&review=${id}`);
  const panel=page.getByRole('dialog');
  await panel.getByText('Зберігаємо URL фото.',{exact:false}).scrollIntoViewIfNeeded();
  await expect(panel.getByText('Фото недоступне за збереженим URL.')).toBeVisible();
  await expect(panel.getByRole('link',{name:'Відкрити збережений URL ↗'})).toHaveAttribute('href',source);
  await expect(panel.getByText('Архів: pending')).toHaveCount(0);
  await expect(panel.getByLabel('Нотатка до фото 1 (необов’язково)')).toHaveCount(1);
});

test('real endpoints require auth, same origin and rollout flag (no mocks)',async({request})=>{
  expect((await request.get('/api/review/boards')).status()).toBe(401);
  expect((await request.post('/api/review/assessments',{data:{}})).status()).toBe(401);
  expect((await request.get('/api/review/reporting?report=statistics')).status()).toBe(401);
  expect((await request.post('/api/review/reporting',{data:{}})).status()).toBe(401);
  const auth=await request.post('/api/auth',{headers:{Origin:'http://127.0.0.1:3217'},data:{password:'local-test-password'}});
  expect(auth.status()).toBe(200);
  expect((await request.get('/api/review/boards')).status()).toBe(503);
  expect((await request.post('/api/review/assessments',{headers:{Origin:'https://foreign.invalid'},data:{}})).status()).toBe(403);
  expect((await request.post('/api/review/assessments',{headers:{Origin:'http://127.0.0.1:3217'},data:{}})).status()).toBe(503);
  expect((await request.get('/api/review/reporting?report=statistics')).status()).toBe(503);
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
  await page.getByText('Експорт навчальних оцінок',{exact:true}).click();
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Експорт JSONL',exact:true}).click();
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
  await page.getByText('Експорт навчальних оцінок',{exact:true}).click();
  await page.getByRole('button',{name:'Експорт JSONL',exact:true}).click();
  await expect(page.getByRole('alert').filter({hasText:'Файл не збережено'})).toBeVisible();expect(downloads).toBe(0);
  await page.screenshot({path:'node_modules/.cache/boards-export-mobile.png',fullPage:true});
  valid=true;const download=page.waitForEvent('download');
  await page.getByRole('button',{name:'Повторити експорт JSONL'}).click();await download;
  expect(ids).toHaveLength(2);expect(ids[0]).toBe(ids[1]);
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
