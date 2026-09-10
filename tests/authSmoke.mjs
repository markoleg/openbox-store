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
const page = await fetch(base + path, { redirect: 'manual', headers: { cookie: cookie.split(';')[0] } });
assert.equal(page.status, 200);
const logout = await fetch(base + '/api/logout', { method: 'POST', headers: { origin: base } });
assert.equal(logout.status, 200);
assert.match(logout.headers.get('set-cookie'), /Max-Age=0/i);
assert.equal((await fetch(base + '/api/logout')).status, 405);
console.log('Auth HTTP smoke passed: redirect, forged cookie, password, origin, signed cookie, protected page, logout.');
