import FoundItems from "@/components/FoundItems/FoundItems";

export default async function ZheZhemonPage() {
    const data = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/supabase/getAllItems`,
        {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            next: { revalidate: 0 }, // This will ensure that the data is always fresh
        }
    )
    const allItems = await data.json()
    return (
        <main className='content'>
            <FoundItems items={allItems} />
        </main>
    )
}
