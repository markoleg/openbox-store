import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerSession } from '@/lib/server/owner';
import { catalogSearchEnabled, searchCatalog } from '@/lib/server/erpCatalog';

/** Part-number picker: proxies the CRM catalog search, which the browser cannot sign. */
export async function GET(req: NextRequest) {
  try { await requireOwnerSession(); } catch { return NextResponse.json({error:'Unauthorized'},{status:401}); }
  if (!catalogSearchEnabled()) return NextResponse.json({error:'disabled'},{status:503});
  const query = (req.nextUrl.searchParams.get('q') ?? '').trim();
  if (!query || query.length > 100) return NextResponse.json({error:'invalid_query'},{status:400});
  try {
    return NextResponse.json({items: await searchCatalog(query)},{headers:{'Cache-Control':'no-store'}});
  } catch (error) {
    console.error('Catalog search failed:', error instanceof Error ? error.message : error);
    return NextResponse.json({error:'catalog_unavailable'},{status:502});
  }
}
