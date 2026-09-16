// Run against the LOCAL test server, configured with the dummy values below.
// No real credentials or procurement mutation endpoints are used.
import assert from 'node:assert/strict';
const base = process.env.AUTH_SMOKE_URL || 'http://127.0.0.1:3217';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) {
  throw new Error('Auth smoke tests require a local server');
}
const path = '/zhezhemon?tab=notifications&delivery=test';
const anonymous = await fetch(base + path, { redirect: 'manual' });
assert.equal(anonymous.status, 307);
assert.equal(new URL(anonymous.headers.get('location')).searchParams.get('next'), path);
const forged = await fetch(base + path, { redirect: 'manual', headers: { cookie: 'local_smoke_owner=true' } });
assert.equal(forged.status, 307);
const login = async (password, origin = base) => fetch(base + '/api/auth', {
  method: 'POST', headers: { 'Content-Type': 'application/json', origin },
  body: JSON.stringify({ password }),
});
assert.equal((await login('wrong')).status, 401);
assert.equal((await login('local-smoke-password', 'https://evil.example')).status, 403);
const signed = await login('local-smoke-password');
assert.equal(signed.status, 200);
const cookie = signed.headers.get('set-cookie');
assert.match(cookie, /HttpOnly/i);
assert.match(cookie, /SameSite=strict/i);
assert.doesNotMatch(cookie, /=true[;]/);
const session = cookie.split(';')[0];
const page = await fetch(base + path, { redirect: 'manual', headers: { cookie: session } });
assert.equal(page.status, 200);
// Start this server with REVIEW_COMMANDS_ENABLED=false. These requests prove
// auth/origin/feature gates without running a command RPC or contacting eBay.
for (const endpoint of ['/api/review/contexts','/api/review/commands','/api/review/searches',
  '/api/review/assessments','/api/review/reporting']) {
  const post = headers => fetch(base + endpoint, {method:'POST',headers,
    body:JSON.stringify({})});
  assert.equal((await post({origin:base})).status,401);
  assert.equal((await post({origin:base,cookie:'local_smoke_owner=true'})).status,401);
  assert.equal((await post({origin:'https://evil.example',cookie:session})).status,403);
  assert.equal((await post({origin:base,cookie:session})).status,503);
}
for (const endpoint of ['/api/review/boards','/api/review/reporting?report=statistics','/api/review/realtime']) {
  assert.equal((await fetch(base + endpoint)).status, 401);
  assert.equal((await fetch(base + endpoint, {headers:{cookie:session}})).status, 503);
}
// Legacy GET links change nothing: they redirect to the authorized confirm page.
const hide = await fetch(base + '/api/hideItem?link=https://www.ebay.com/itm/1', { redirect: 'manual' });
assert.equal(hide.status, 303);
assert.equal(new URL(hide.headers.get('location')).pathname, '/zhezhemon/confirm');
const ban = await fetch(base + '/api/banItem?searchId=1&link=https://www.ebay.com/itm/1', { redirect: 'manual' });
assert.equal(ban.status, 303);
assert.equal(new URL(ban.headers.get('location')).searchParams.get('action'), 'ban');
assert.equal((await fetch(base + '/zhezhemon/confirm?action=hide&link=x', { redirect: 'manual' })).status, 307);
// Telegram webhook: secret first; review callbacks without an allowlisted user
// never reach the command core (the server here has no BOT_TOKEN either).
const webhook = (headers, body) => fetch(base + '/api/telegram/webhook', {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
});
const callback = { callback_query: { id: '1', data: 'rv:0f1e2d3c4b5a4978887766554433221f:hide', from: { id: 5 },
  message: { message_id: 7, date: 1, chat: { id: 9 } } } };
assert.equal((await webhook({}, callback)).status, 403);
assert.equal((await webhook({ 'x-telegram-bot-api-secret-token': 'wrong' }, callback)).status, 403);
const accepted = await webhook({ 'x-telegram-bot-api-secret-token': 'local-smoke-webhook' }, callback);
assert.equal(accepted.status, 200);
const legacy = await webhook({ 'x-telegram-bot-api-secret-token': 'local-smoke-webhook' },
  { callback_query: { id: '2', data: 'zh:123', from: { id: 5 }, message: { message_id: 7, chat: { id: 9 } } } });
assert.equal(legacy.status, 200);
const logout = await fetch(base + '/api/logout', { method: 'POST', headers: { origin: base } });
assert.equal(logout.status, 200);
assert.match(logout.headers.get('set-cookie'), /Max-Age=0/i);
assert.equal((await fetch(base + '/api/logout')).status, 405);
console.log('Auth HTTP smoke passed: session, origin, protected page, review API gates, legacy redirects, webhook gates, logout.');
