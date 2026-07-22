import ShopFoundItems from '@/components/ShopParser/FoundItems/ShopFoundItems';
import ShopSearchForm from '@/components/ShopParser/SearchForm/ShopSearchForm';

export default async function ShopItemsBySearchPage({ params }: { params: Promise<{ id: number }> }) {
    const { id } = await params;

    return (
        <main className='content'>
            <ShopSearchForm searchId={id} />
            <ShopFoundItems id={id} />
        </main>
    )
}
