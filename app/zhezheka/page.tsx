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
    const getStartOfDay = (date: Date) => {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        return d;
    };
    const [from, setFrom] = useState(getStartOfDay(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)));
    const [to, setTo] = useState(new Date());
    // console.log(from, to);
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
                                value={from.toLocaleDateString('uk-UA').split('.').reverse().join('-')}
                                onChange={handleDateChange}
                            />
                        </label>
                        <label>
                            To:{" "}
                            <input
                                type="date"
                                name="to"
                                value={to.toLocaleDateString('uk-UA').split('.').reverse().join('-')}
                                onChange={handleDateChange}
                            />
                        </label>
                    </div>

                </div>

                <SummaryCards from={from} to={to} />


                {/* Юзер-графік */}
                {selectedUser ?
                    <UserKeywordChart senderId={selectedUser} from={from} to={to} />

                    :
                    <GlobalKeywordChart from={from} to={to} />

                }

                <ParamsForm />
            </div>
        </>

    );
}
