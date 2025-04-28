import FoundItems from '@/components/FoundItems/FoundItems';
import SearchForm from '@/components/SearchForm/SearchForm';

export default async function FoundItemsBySearchPage({ params }: { params: Promise<{ id: number }> }) {
    const { id } = await params;

    return (
        <>
            <main className='content'>
                <SearchForm searchId={id} />
                <FoundItems id={id} />
            </main>
        </>

    )
}
