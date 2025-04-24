import FoundItems from '@/components/FoundItems/FoundItems';
import AsideMenu from '@/components/AsideMenu/AsideMenu'

export default async function FoundItemsBySearchPage({ params }: { params: { id: number } }) {
    const { id } = await params;

    return (
        <>
            {/* <AsideMenu /> */}
            <main className='content'>
                <FoundItems id={id} />
            </main>
        </>

    )
}
