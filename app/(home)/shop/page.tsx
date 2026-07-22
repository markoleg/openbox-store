import ShopFoundItems from "@/components/ShopParser/FoundItems/ShopFoundItems";
import AddNewShopSearchForm from "@/components/ShopParser/SearchForm/AddNewShopSearchForm";
import GlobalBannedSellers from "@/components/ShopParser/GlobalBannedSellers/GlobalBannedSellers";
import BannedProducts from "@/components/ShopParser/BannedProducts/BannedProducts";

export default async function ShopPage() {
    return (
        <main className='content'>
            <div style={{ display: 'flex', flexDirection: 'column', gap: "0.5rem" }}>
                <GlobalBannedSellers />
                <BannedProducts />
                <AddNewShopSearchForm />
            </div>
            <ShopFoundItems id={undefined} />
        </main>
    )
}
