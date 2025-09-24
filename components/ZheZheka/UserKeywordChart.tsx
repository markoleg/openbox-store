'use client';

import { useEffect, useState } from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { supabase } from '@/lib/SupaBaseClient';

type ChartRow = {
    day: string;
    [keyword: string]: number | string;
};

export default function UserKeywordChart({
    senderId,
    from,
    to,
}: {
    senderId: number;
    from: Date;
    to: Date;
}) {
    const [data, setData] = useState<ChartRow[]>([]);
    const [username, setUsername] = useState<string | null>(null);
    useEffect(() => {
        const fetchChartData = async () => {
            const { data: rawData, error } = await supabase.rpc('user_keyword_stats_by_day', {
                sender_id_input: senderId,
                from_date: from.toISOString(),
                to_date: to.toISOString(),
            });

            if (error) {
                console.error('Supabase RPC error:', error);
                return;
            }
            if (rawData.length) setUsername(rawData[0].username || null);
            // Групуємо в формат для Recharts
            const grouped: { [day: string]: ChartRow } = {};

            rawData.forEach((row: any) => {
                const day = row.day; // Припускаємо, що row.day вже у форматі 'YYYY-MM-DD'
                if (!grouped[day]) grouped[day] = { day };
                grouped[day][row.keyword] = Number(row.count);
            });

            // Зібрати список всіх keyword
            const allKeywords = [...new Set(rawData.map((row: any) => row.keyword))];

            // Перетворити у масив і заповнити відсутні ключі нулями
            const chartData = Object.values(grouped).map((row) => {
                allKeywords.forEach((kw: any) => {
                    if (!(kw in row)) row[kw] = 0;
                });
                return row;
            }).sort((a, b) => new Date(a.day).getTime() - new Date(b.day).getTime());

            setData(chartData);
            console.log('Chart data:', chartData);
        };

        fetchChartData();
    }, [senderId, from, to]);

    return (
        <div>
            <h2 >📊 {username ? `@${username}` : `User ${senderId}`} Activity</h2>
            <br />
            <ResponsiveContainer width="100%" height={300} >
                <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    {data.length > 0 &&
                        Object.keys(data[0])
                            .filter((k) => k !== 'day')
                            .map((keyword, i) => (
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
