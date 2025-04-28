import FoundItems from "@/components/FoundItems/FoundItems";
import AddNewSearchForm from "@/components/SearchForm/AddNewSearchForm";

export default async function ZheZhemonPage() {

    return (
        <>
            <main className='content'>
                <AddNewSearchForm />
                <FoundItems id={undefined} />
            </main>
        </>
    )
}
