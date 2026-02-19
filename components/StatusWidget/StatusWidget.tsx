'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader } from 'lucide-react';
import styles from './StatusWidget.module.css';

type SearchItem = {
  id: number;
  keywords: string;
  last_ok: string | null;
  last_error: string | null;
  last_check: string | null;
  boundary_churn_warning: boolean;
};

type StatusResponse = {
  ok: boolean;
  revalidated_at: string;
  searches: SearchItem[];
};

const STATUS_URL = '/api/status';
const ONE_HOUR_MS = 60 * 60 * 1000;

/** Parse ISO string as UTC when no timezone is specified (e.g. revalidated_at) */
function parseAsUtc(iso: string): Date {
  const trimmed = String(iso).trim();
  if (!trimmed) return new Date(NaN);
  if (!/[zZ]|[\+\-]\d{2}:?\d{2}$/.test(trimmed)) {
    return new Date(trimmed + 'Z');
  }
  return new Date(trimmed);
}

function formatRelativeTime(iso: string | null): string {
  if (iso == null || String(iso).trim() === '') return '—';
  const date = parseAsUtc(iso);
  const ts = date.getTime();
  if (Number.isNaN(ts)) return '—';
  const now = Date.now();
  const diffMs = now - ts;
  if (diffMs < 60_000) return 'just now';
  if (diffMs < 3600_000) return `${Math.floor(diffMs / 60_000)}m ago`;
  if (diffMs < 86400_000) return `${Math.floor(diffMs / 3600_000)}h ago`;
  return date.toLocaleString();
}

/** Error if last_ok was more than 1 hour before last_check (not before "now") */
function isStale(lastOk: string | null, lastCheck: string | null): boolean {
  if (lastOk == null || String(lastOk).trim() === '') return true;
  const okTs = parseAsUtc(lastOk).getTime();
  if (Number.isNaN(okTs)) return true;

  const refTs =
    lastCheck != null && String(lastCheck).trim() !== ''
      ? parseAsUtc(lastCheck).getTime()
      : Date.now();
  if (Number.isNaN(refTs)) return Date.now() - okTs > ONE_HOUR_MS;

  return refTs - okTs > ONE_HOUR_MS;
}

export default function StatusWidget() {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let abort = new AbortController();

    const fetchStatus = async () => {
      abort?.abort();
      abort = new AbortController();
      const { signal } = abort;
      try {
        const res = await fetch(STATUS_URL, { signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: StatusResponse = await res.json();
        if (!json?.ok || !Array.isArray(json?.searches)) {
          setError('App server unhealthy');
          return;
        }
        setData(json);
        setError(null);
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
        setError(e instanceof Error ? e.message : 'Failed to fetch');
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 60_000);
    return () => {
      clearInterval(interval);
      abort?.abort();
    };
  }, []);

  if (loading) {
    return (
      <div className={styles.wrapper}>
        <Loader color="var(--primary)" className="loader" size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.wrapper}>
        <p className={styles.serverError}>Check app server</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className={styles.wrapper}>
      <header className={styles.header}>
        <h2>Running tasks</h2>
        <span className={styles.revalidated}>
          Revalidated {formatRelativeTime(data.revalidated_at)}
        </span>
      </header>
        <div className={styles.legend}>
          <span title="Last OK &gt; 1h before last check or missing">
            <span className={styles.badgeError}>Error</span> stale/failed
          </span>
          <span title="Items near result boundaries changed – verify thresholds">
            <span className={styles.badgeCheck}>Check</span> boundary churn
          </span>
        </div>
      <div className={styles.grid}>
        {data.searches.map((s) => {
          const hasError = isStale(s.last_ok, s.last_check);
          const needsCheck = s.boundary_churn_warning;
          return (
            <Link key={s.id} href={`/zhezhemon/${s.id}`} className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.keywords}>{s.keywords}</span>
                <div className={styles.badges}>
                  {hasError && <span className={styles.badgeError}>Error</span>}
                  {needsCheck && (
                    <span
                      className={styles.badgeCheck}
                      title="Items near result boundaries changed – verify thresholds"
                    >
                      Check
                    </span>
                  )}
                </div>
              </div>
              <div className={styles.meta}>
                <span title={s.last_ok ?? undefined}>
                  Last OK: {formatRelativeTime(s.last_ok)}
                </span>
                <span title={s.last_check ?? undefined}>
                  Checked: {formatRelativeTime(s.last_check)}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
