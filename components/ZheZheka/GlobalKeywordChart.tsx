'use client';

import { useEffect, useState } from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { supabase } from '@/lib/SupaBaseClient';
import { Loader } from 'lucide-react';

type ChartRow = {
    day: string;
    [keyword: string]: number | string;
};

export default function GlobalKeywordChart({
    from,
    to,
}: {
    from: Date;
    to: Date;
}) {
    const [data, setData] = useState<ChartRow[]>([]);

    useEffect(() => {
        const fetchChartData = async () => {
            const { data: rawData, error } = await supabase.rpc(
                'global_keyword_stats_by_day',
                {
                    from_date: from.toISOString(),
                    to_date: to.toISOString(),
                }
            );

            if (error) {
                console.error('Supabase RPC error:', error);
                return;
            }

            const grouped: { [day: string]: ChartRow } = {};
            rawData.forEach((row: any) => {
                const day = row.day.split('T')[0];
                if (!grouped[day]) grouped[day] = { day };
                grouped[day][row.keyword] = Number(row.count);
            });

            const chartData = Object.values(grouped).sort(
                (a, b) => new Date(a.day).getTime() - new Date(b.day).getTime()
            );
            setData(chartData);
        };

        fetchChartData();
    }, [from, to]);
    if (!data.length) return <Loader color='var(--primary)' className='loader' />;
    // Collect all unique keywords across all days (excluding 'day')
    const allKeywords = Array.from(
        new Set(
            data.flatMap(row => Object.keys(row).filter(k => k !== 'day'))
        )
    );
    // console.log(allKeywords);
    return (
        <div style={{ width: '100%' }}>
            <h2 >🌍 Global keywords stats</h2>
            <br />
            <ResponsiveContainer width="100%" height={300} >
                <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    {allKeywords.map((keyword, i) => (
                        <Line
                            key={keyword}
                            type="monotone"
                            dataKey={keyword}
                            strokeWidth={2}
                            stroke={`hsl(${i * 60}, 70%, 50%)`}
                        />
                    ))}
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
