import FoundItems from '@/components/FoundItems/FoundItems';
import React from 'react'

export default async function FoundItemsBySearchPage({ params }: { params: { id: string } }) {
    const { id } = await params;
    const items = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/supabase/getItemsBySearch?searchId=${id}`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        },
    }).then((res) => res.json()).catch((err) => {
        console.error("Error fetching data:", err);
    });
    return (
        <main className='content'>
            <FoundItems items={items} />
        </main>
    )
}
