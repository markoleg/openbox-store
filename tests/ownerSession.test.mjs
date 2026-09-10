import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createOwnerSession, verifyOwnerSession, ownerPasswordMatches,
         SESSION_SECONDS, sessionCookieName } from '../lib/ownerSession.ts';
import { safeReturnPath } from '../lib/safeReturnPath.ts';
import { hasSameOrigin } from '../lib/requestOrigin.ts';

beforeEach(() => {
  process.env.OWNER_SESSION_SECRET = 'local-test-secret-not-for-production-123456789';
  process.env.PASSWORD = 'local-test-password';
  process.env.PASSWORD_COOKIE_NAME = 'test_owner';
});

test('signed session is buyer-only and expires at the deadline', async () => {
  const token = await createOwnerSession(1000);
  assert.equal(await verifyOwnerSession(token, 1001), true);
  assert.equal(await verifyOwnerSession(token, 1000 + SESSION_SECONDS), false);
  assert.equal(await verifyOwnerSession(token, 999), false);
});

test('old true cookie, malformed tokens and tampering are rejected', async () => {
  const token = await createOwnerSession(1000);
  const [payload, signature] = token.split('.');
  const claims = JSON.parse(Buffer.from(payload, 'base64url'));
  const modified = Buffer.from(JSON.stringify({ ...claims, exp: claims.exp + 100 })).toString('base64url');
  for (const value of ['true', 'false', '', undefined, token + '.extra', modified + '.' + signature,
    payload + '.invalid', 'x'.repeat(4096)]) {
    assert.equal(await verifyOwnerSession(value, 1001), false);
  }
});

test('secret rotation and missing configuration fail closed', async () => {
  const token = await createOwnerSession(1000);
  process.env.OWNER_SESSION_SECRET = 'a-different-local-test-secret-123456789';
  assert.equal(await verifyOwnerSession(token, 1001), false);
  delete process.env.OWNER_SESSION_SECRET;
  assert.equal(await verifyOwnerSession(token, 1001), false);
  await assert.rejects(createOwnerSession(1000), /not configured/);
});

test('each login has a different token', async () => {
  assert.notEqual(await createOwnerSession(1000), await createOwnerSession(1000));
});

test('password must be configured and be a matching string', async () => {
  assert.equal(await ownerPasswordMatches('local-test-password'), true);
  for (const input of ['wrong', '', null, undefined, {}, 123]) {
    assert.equal(await ownerPasswordMatches(input), false);
  }
  delete process.env.PASSWORD;
  assert.equal(await ownerPasswordMatches(undefined), false);
});

test('cookie name must be a valid configured name', () => {
  assert.equal(sessionCookieName(), 'test_owner');
  process.env.PASSWORD_COOKIE_NAME = 'bad; cookie';
  assert.throws(sessionCookieName);
});

test('deep link preserves exact tab and delivery', () => {
  const path = '/zhezhemon/processing?tab=notifications&delivery=abc#details';
  assert.equal(safeReturnPath(path), path);
});

test('return URL cannot redirect to an external origin or a mutation endpoint', () => {
  for (const value of ['https://evil.example', '//evil.example', '/\\evil.example',
    '/\nevil.example', '/login', '/api/ban', '/x/../api/logout', null]) {
    assert.equal(safeReturnPath(value), '/');
  }
});

test('origin validation uses public host and denies missing or foreign origins', () => {
  assert.equal(hasSameOrigin(new Headers({ origin: 'https://dashboard.example', host: 'dashboard.example' })), true);
  for (const origin of ['https://evil.example', 'null', 'not a URL', 'https://dashboard.example/']) {
    assert.equal(hasSameOrigin(new Headers({ origin, host: 'dashboard.example' })), false);
  }
  assert.equal(hasSameOrigin(new Headers({ host: 'dashboard.example' })), false);
});
