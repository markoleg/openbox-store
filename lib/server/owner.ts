import 'server-only';
import { cookies } from 'next/headers';
import { sessionCookieName, verifyOwnerSession } from '@/lib/ownerSession';

// New review server actions/routes must call this before accessing private
// history. Middleware protects navigation; it does not authorize API calls.
export async function requireOwnerSession(): Promise<'buyer'> {
  const token = (await cookies()).get(sessionCookieName())?.value;
  if (!await verifyOwnerSession(token)) throw new Error('Unauthorized');
  return 'buyer';
}
