import { useEffect, useState } from 'react';
import { supabase } from '@/lib/SupaBaseClient';

type Sender = {
    sender_id: number;
    username: string | null;
};

export default function UserSelector({
    onSelect,
}: {
    onSelect: (id: number) => void;
}) {
    const [users, setUsers] = useState<Sender[]>([]);

    useEffect(() => {
        const fetchUsers = async () => {
            const { data } = await supabase
                .from('zzk_senders')
                .select('sender_id, username')
                .order('message_count', { ascending: false });

            if (data) setUsers(data);
        };

        fetchUsers();
    }, []);

    return (
        <select
            onChange={(e) => onSelect(Number(e.target.value))}

        >
            <option value="">-- Select User --</option>
            {users.map((u) => (
                <option key={u.sender_id} value={u.sender_id}>
                    {u.username ? `@${u.username}` : `User ${u.sender_id}`}
                </option>
            ))}
        </select>
    );
}
