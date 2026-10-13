import 'server-only';
import {reviewDatabase} from './reviewCommands';
import type {SearchFilters} from '@/components/ZheZhemon/SearchForm/FiltersFieldset';

/** Rules applied to every search on top of its own (zhezhemon migration 034). */
export type GlobalFilters = {filters: SearchFilters; version: number};
export type GlobalFiltersResult = GlobalFilters & {status: 'applied' | 'noop' | 'conflict'};

/** The current global rules, or null when they cannot be read (e.g. 034 not applied). */
export async function readGlobalFilters(): Promise<GlobalFilters | null> {
  try {
    const {data, error} = await reviewDatabase().from('global_search_filters').select('filters,version').eq('id', 1).maybeSingle();
    if (error || !data) return null;
    return {filters: (data.filters ?? {}) as SearchFilters, version: Number(data.version)};
  } catch {
    return null;
  }
}

/** Version-checked save: a stale form gets a conflict with the current rules, never an overwrite. */
export async function saveGlobalFilters(commandId: string, expectedVersion: number, filters: SearchFilters): Promise<GlobalFiltersResult> {
  const {data, error} = await reviewDatabase().rpc('save_global_search_filters',
    {p_command: commandId, p_expected_version: expectedVersion, p_filters: filters});
  if (error) throw new Error('global_filters_failed');
  const result = data as {status: GlobalFiltersResult['status']; version: number; filters: SearchFilters};
  return {status: result.status, version: Number(result.version), filters: result.filters ?? {}};
}
