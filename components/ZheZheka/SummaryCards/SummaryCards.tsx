'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/SupaBaseClient';
import styles from './SummaryCards.module.css';
import { Loader } from 'lucide-react';

export default function SummaryCards({
    from,
    to,
}: {
    from: Date;
    to: Date;
}) {
    const [topUsers, setTopUsers] = useState<
        { sender_id: number; username: string | null; message_count: number }[]
    >([]);
    const [topKeywords, setTopKeywords] = useState<
        { keyword: string; usage_count: number }[]
    >([]);
    const [totalMessages, setTotalMessages] = useState<number>(0);

    useEffect(() => {
        const fetchSummary = async () => {
            const [users, keywords, total] = await Promise.all([
                supabase.rpc('top_users_by_messages', {
                    from_date: from.toISOString(),
                    to_date: to.toISOString(),
                }),
                supabase.rpc('top_keywords_by_usage', {
                    from_date: from.toISOString(),
                    to_date: to.toISOString(),
                }),
                supabase.rpc('total_messages_in_period', {
                    from_date: from.toISOString(),
                    to_date: to.toISOString(),
                }),
            ]);

            if (users.data) setTopUsers(users.data);
            if (keywords.data) setTopKeywords(keywords.data);
            if (total.data) setTotalMessages(total.data);
        };

        fetchSummary();

        // Optional: auto-refresh every 30s
        const interval = setInterval(fetchSummary, 30000);
        return () => clearInterval(interval);
    }, [from, to]);

    return (
        <div className={styles.summaryCards}>
            <div className={styles.card}>
                <h3 >📬 Total Messages</h3>
                <p >{totalMessages}</p>
            </div>

            <div className={styles.card}>
                <h3 >👥 Top Users</h3>
                {topUsers.length ? (
                    <ul >
                        {topUsers.map((u) => (
                            <li key={u.sender_id}>
                                {u.username ? `@${u.username}` : `User ${u.sender_id}`} –{' '}
                                <strong>{u.message_count}</strong>
                            </li>
                        ))}
                    </ul>
                ) : (
                    // <p>No data</p>
                    <Loader color='var(--primary)' className='loader' />
                )}
            </div>

            <div className={styles.card}>
                <h3 >🔑 Top Keywords</h3>
                {topKeywords.length ? (
                    <ul >
                        {topKeywords.map((k) => (
                            <li key={k.keyword}>
                                {k.keyword}: <strong>{k.usage_count}</strong>
                            </li>
                        ))}
                    </ul>
                ) : (
                    // <p>No data</p>
                    <Loader color='var(--primary)' className='loader' />
                )}
            </div>
        </div>
    );
}
