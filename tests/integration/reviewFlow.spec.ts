import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
const origin='http://127.0.0.1:3218';
test('real owner API + PostgREST + PG: URL-only card, outcome, submit, stats, export and revision conflict',async({page,request})=>{
  await page.route('**/*',route=>{
    // No external page assets/eBay/Telegram traffic. Local API responses are never mocked.
    const host=new URL(route.request().url()).hostname;
    return host==='127.0.0.1'?route.continue():route.abort();
  });
  expect((await request.get('/api/review/boards')).status()).toBe(401);
  const anon={Authorization:`Bearer ${process.env.REVIEW_TEST_ANON_JWT}`};
  const denied=await request.get('http://127.0.0.1:54835/rest/v1/snapshot_photos',{headers:anon});
  expect([401,403]).toContain(denied.status());expect((await denied.json()).code).toBe('42501');
  expect((await request.post('http://127.0.0.1:54835/rest/v1/rpc/review_statistics',{headers:anon,data:{}})).status()).not.toBe(200);
  expect((await request.post('/api/auth',{headers:{Origin:origin},data:{password:'local-integration-password'}})).status()).toBe(200);
  // Browser uses the real login too, not a fabricated cookie.
  await page.goto('/login?next=%2Fzhezhemon%2Fprocessing%3Ftab%3Dreview');await page.locator('input[type=password]').fill('local-integration-password');
  await page.locator('button[type=submit]').click();
  await expect(page).toHaveURL(/\/zhezhemon\/processing\?tab=review$/,{timeout:30000});
  const boardResponse=await request.get('/api/review/boards?tab=review');
  expect(boardResponse.status(),await boardResponse.text()).toBe(200);
  const board=await boardResponse.json(),card=board.columns.new.cards[0];expect(card).toBeTruthy();
  expect(card.search_name).toBe('item model');
  await page.getByRole('button',{name:/An item/}).click();
  const panel=page.getByRole('dialog');
  await expect(panel.getByText('Зберігаємо URL фото.',{exact:false})).toBeVisible();
  await panel.getByText('Ціна, доставка й пошуковий коридор',{exact:true}).click();
  await expect(panel.getByText('"max": "500"',{exact:false})).toBeVisible();
  await panel.getByRole('button',{name:'Приховати до подешевшання'}).click();
  await expect(panel.getByLabel('Рішення для навчальної оцінки')).not.toHaveValue('');
  for(const label of ['Заголовок','Магазин','Параметри','Опис','Фото','Ціна з доставкою']) {
    await panel.getByLabel(`${label}: бал`).selectOption('4');
    await panel.getByLabel(`${label}: пояснення`).fill('Integration fixture assessment');
  }
  await panel.getByRole('button',{name:'Здати оцінку',exact:true}).click();
  await expect(panel.getByText('Оцінку здано. Подальші сповіщення не змінюють цю версію.')).toBeVisible();
  await panel.getByRole('button',{name:'Закрити ×'}).click();
  await expect(page.locator('[data-stage=done]').getByRole('button',{name:/An item/})).toBeVisible();
  const statsResponse=await request.get('/api/review/reporting?report=statistics');expect(statsResponse.status()).toBe(200);
  const stats=await statsResponse.json();expect(stats.summary.deliveries).toBe(1);expect(stats.summary.direct_samples).toBe(1);
  const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'Експорт',exact:true}).click();
  const download=await downloading,stream=await download.createReadStream();let content='';for await(const chunk of stream!)content+=chunk.toString();
  const rows=content.trim().split('\n').map(line=>JSON.parse(line));
  expect(rows.map(r=>r.type)).toEqual(['manifest','training_example','complete']);
  expect(rows[1].archive[0].status).toBe('url_only');expect(rows[1].archive[0].contentHash).toBeNull();
  expect(rows[1].features.photos[0].sourceUrl).toContain('ebayimg.com');
  expect(rows[1].decision.outcome).toBe('hidden');expect(rows[1].assessment.score_title).toBe(4);
  // The API and SQL version fence protect simultaneous edits; export remains frozen.
  const detail=await (await request.get(`/api/review/boards?tab=review&id=${card.id}`)).json();
  const post=(data:unknown)=>request.post('/api/review/assessments',{headers:{Origin:origin},data});
  const reopened=await post({commandId:randomUUID(),reviewId:card.id,version:detail.review.version,action:'reopen',payload:{reason:'Integration revision'}});
  expect(reopened.status(),await reopened.text()).toBe(200);
  const version=(await reopened.json()).version;
  const edits=await Promise.all([2,3].map(score=>post({commandId:randomUUID(),reviewId:card.id,version,action:'draft',payload:{score_title:score}})));
  expect(edits.map(r=>r.status()).sort()).toEqual([200,409]);
  const exported=await (await request.get(`/api/review/reporting?report=export&id=${rows[0].id}`)).json();
  expect(exported.rows[0].assessment.score_title).toBe(4);
  const history=await (await request.get(`/api/review/reporting?report=history&link=${encodeURIComponent(card.link)}`)).json();
  expect(history.rows.some((r:any)=>r.action==='hide')).toBe(true);
  expect((await request.post('/api/review/reporting',{headers:{Origin:'https://foreign.invalid'},data:{}})).status()).toBe(403);
  await page.screenshot({path:'node_modules/.cache/review-real-integration.png',fullPage:true});
});
