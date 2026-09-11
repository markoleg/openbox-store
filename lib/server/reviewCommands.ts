import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { ReviewCommand, ReviewCommandResult, ReviewContextKind } from '@/lib/reviewCommands';

function reviewDatabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!key || !url) throw new Error('review_server_not_configured');
  return createClient(url, key, {auth: {persistSession: false, autoRefreshToken: false}});
}

async function rpc(name: string, args: Record<string, unknown>) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const {data, error} = await reviewDatabase().rpc(name, args);
    if (!error) return data;
    if (['40P01','40001'].includes(error.code) && attempt < 2) {
      await new Promise(resolve => setTimeout(resolve, 30 * (attempt + 1)));
      continue;
    }
    // Do not expose SQL details or raw listing data to the HTTP error response.
    throw new Error(['22023','22P02','P0002'].includes(error.code) ? 'invalid_review_request' : 'review_storage_failed');
  }
  throw new Error('review_storage_failed');
}

// Internal server primitives; callers MUST authenticate before using these.
// They never fetch eBay, infer a delivery by link, or accept an actor/time from the client.
export function issueReviewContext(kind: ReviewContextKind, target: string) {
  return rpc('issue_review_context', {p_kind: kind, p_target: target});
}
export async function applyReviewCommand(command: ReviewCommand): Promise<ReviewCommandResult> {
  return rpc('apply_review_command', {p_command: command.commandId, p_context: command.contextId,
    p_action: command.action, p_payload: command.payload, p_source: 'dashboard'});
}
