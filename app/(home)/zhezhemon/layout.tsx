import AsideMenu from '@/components/AsideMenu/AsideMenu'

export default async function Layout({ children }: { children: React.ReactNode }) {
    const searches = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/supabase/getAllSearches`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        },
        next: { revalidate: 0 }, // This will ensure that the data is always fresh
    }).then((res) => res.json()).catch((err) => {
        console.error("Error fetching data:", err);
    });
    const allItems = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/supabase/getAllItems`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        },
    }).then((res) => res.json()).catch((err) => {
        console.error("Error fetching data:", err);
    });
    const asideMenuList = searches
        .map((search: any) => {
            const items = allItems.filter((item: any) => item.search_parameter_id === search.id);
            const { id, keywords, seller, condition } = search;
            const searchCondition = condition === 1000 ? "New" : condition === 1500 ? "OpenBox" : "Used";
            const searchName = `${seller ?? ""} ${keywords} ${searchCondition}`;
            return {
                name: searchName,
                path: `/zhezhemon/${id}`,
                id: id,
                items: items.length
            };
        })
        .sort((a: any, b: any) => a.id - b.id)

    return (
        <div className="page-wrp">
            <AsideMenu list={asideMenuList} allItems={allItems.length} />
            {children}
        </div>
    )
}