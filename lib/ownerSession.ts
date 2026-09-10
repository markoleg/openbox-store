// Web Crypto works in both Next middleware (Edge) and server routes.
// This module is server/middleware-only, never import it into client components.
export const SESSION_SECONDS = 14 * 24 * 60 * 60;
const encoder = new TextEncoder();

function signingSecret(): string {
  const secret = process.env.OWNER_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error('Owner session is not configured');
  return secret;
}

export function sessionCookieName(): string {
  const name = process.env.PASSWORD_COOKIE_NAME;
  if (!name || !/^[A-Za-z0-9_-]+$/.test(name)) throw new Error('Session cookie is not configured');
  return name;
}

async function key() {
  return crypto.subtle.importKey('raw', encoder.encode(signingSecret()),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

function encode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decode(value: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid session');
  return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
}

export async function createOwnerSession(now = Math.floor(Date.now() / 1000)): Promise<string> {
  const payload = encode(encoder.encode(JSON.stringify({
    v: 1, sub: 'buyer', iat: now, exp: now + SESSION_SECONDS, nonce: crypto.randomUUID(),
  })));
  const signature = await crypto.subtle.sign('HMAC', await key(), encoder.encode(payload));
  return `${payload}.${encode(new Uint8Array(signature))}`;
}

export async function verifyOwnerSession(token?: string, now = Math.floor(Date.now() / 1000)): Promise<boolean> {
  if (!token || token.length > 2048) return false;
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return false;
    const [payload, signature] = parts;
    if (!await crypto.subtle.verify('HMAC', await key(), decode(signature), encoder.encode(payload))) return false;
    const claims = JSON.parse(new TextDecoder().decode(decode(payload)));
    return claims.v === 1 && claims.sub === 'buyer'
      && Number.isSafeInteger(claims.iat) && Number.isSafeInteger(claims.exp)
      && claims.iat <= now && claims.exp > now
      && claims.exp - claims.iat === SESSION_SECONDS;
  } catch {
    return false;
  }
}

export async function ownerPasswordMatches(candidate: unknown): Promise<boolean> {
  const password = process.env.PASSWORD;
  if (!password || typeof candidate !== 'string' || candidate.length > 1024) return false;
  const [a, b] = await Promise.all([candidate, password].map(value =>
    crypto.subtle.digest('SHA-256', encoder.encode(value))));
  const left = new Uint8Array(a), right = new Uint8Array(b);
  let different = 0;
  for (let i = 0; i < left.length; i++) different |= left[i] ^ right[i];
  return different === 0;
}
