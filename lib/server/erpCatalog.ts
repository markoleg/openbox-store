import 'server-only';
import {createHmac} from 'node:crypto';
import type {CatalogMatch} from '@/lib/reviewBoards';

// The CRM's POST /integrations/zhezhemon/catalog-search, signed with the same
// secret as Zhezhemon's listing-context call. Unset means the picker stays a plain input.
const URL = process.env.ERP_CATALOG_SEARCH_URL;
const SECRET = process.env.ZHEZHEMON_WEBHOOK_SECRET;
const TIMEOUT_MS = 5000;

export const catalogSearchEnabled = () => !!URL && !!SECRET;

/** The CRM's purchase-picker search: same matches and order, at most 20. */
export async function searchCatalog(query: string): Promise<CatalogMatch[]> {
  if (!URL || !SECRET) throw new Error('catalog_search_disabled');
  const body = JSON.stringify({query, limit: 20});
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac('sha256', SECRET).update(`${timestamp}.${body}`).digest('hex');
  const res = await fetch(URL, {
    method: 'POST', body, cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {'content-type': 'application/json', 'x-webhook-timestamp': timestamp, 'x-webhook-signature': signature},
  });
  if (!res.ok) throw new Error(`catalog_search_${res.status}`);
  const data = await res.json() as {items?: unknown};
  if (!Array.isArray(data.items)) throw new Error('catalog_search_invalid');
  return data.items.flatMap((item): CatalogMatch[] => {
    const {id, modelNumber, name, fullName} = (item ?? {}) as Record<string, unknown>;
    return Number.isSafeInteger(id) && typeof modelNumber === 'string' && modelNumber
      ? [{id: id as number, modelNumber, name: typeof name === 'string' ? name : null, fullName: typeof fullName === 'string' ? fullName : null}]
      : [];
  });
}
