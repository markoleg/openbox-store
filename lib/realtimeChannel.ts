import type {SupabaseClient} from '@supabase/supabase-js';

/** One effect owns one channel, even while a previous cleanup is still pending.
 * Supabase reuses channel objects by topic; independent consumers must not
 * subscribe twice to the same object or unsubscribe each other's listeners.
 * Call inside the effect, not at render time. Keep the table filters unchanged.
 */
export function ownedRealtimeChannel(client: Pick<SupabaseClient, 'channel'>, scope: string) {
  return client.channel(`${scope}:${crypto.randomUUID()}`);
}
