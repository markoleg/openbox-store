'use client';

import { useState } from 'react';
import UserKeywordChart from '@/components/ZheZheka/UserKeywordChart';
import UserSelector from '@/components/ZheZheka/UserSelector';
import GlobalKeywordChart from '@/components/ZheZheka/GlobalKeywordChart';
import ParamsForm from '@/components/ZheZheka/ParamsForm/ParamsForm';
import SummaryCards from '@/components/ZheZheka/SummaryCards/SummaryCards';
import styles from './page.module.css';

export default function DashboardPage() {
    const [selectedUser, setSelectedUser] = useState<number | null>(null);
    const [from, setFrom] = useState(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
    const [to, setTo] = useState(new Date());

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        const parsed = new Date(value);
        if (name === 'from') setFrom(parsed);
        else setTo(parsed);
    };

    return (
        <>

            <div className={styles.dashboard}>
                <h1 >Keywords stats</h1>
                {/* Фільтри */}
                <div className={styles.filters}>
                    <UserSelector onSelect={setSelectedUser} />
                    <div className={styles.dateFilters}>

                        <label>
                            From:{" "}
                            <input
                                type="date"
                                name="from"
                                value={from.toISOString().split('T')[0]}
                                onChange={handleDateChange}
                                className="border p-1 rounded"
                            />
                        </label>
                        <label>
                            To:{" "}
                            <input
                                type="date"
                                name="to"
                                value={to.toISOString().split('T')[0]}
                                onChange={handleDateChange}
                                className="border p-1 rounded"
                            />
                        </label>
                    </div>

                </div>

                <SummaryCards from={from} to={to} />

                {/* Глобальний графік */}
                <GlobalKeywordChart from={from} to={to} />

                {/* Юзер-графік */}
                {selectedUser && (
                    <UserKeywordChart senderId={selectedUser} from={from} to={to} />
                )}

                <ParamsForm />
            </div>
        </>

    );
}
