import FoundItems from "@/components/ZheZhemon/FoundItems/FoundItems";
import AddNewSearchForm from "@/components/ZheZhemon/SearchForm/AddNewSearchForm";
import GlobalRulesForm from "@/components/ZheZhemon/SearchForm/GlobalRulesForm";
import { readGlobalFilters } from "@/lib/server/globalFilters";

// The global rules must be read fresh, never from a build-time render.
export const dynamic = 'force-dynamic';

export default async function ZheZhemonPage() {
    const globalFilters = await readGlobalFilters();

    return (
        <>
            <main className='content'>
                <GlobalRulesForm initial={globalFilters} />
                <AddNewSearchForm />
                <FoundItems id={undefined} />
            </main>
        </>
    )
}
