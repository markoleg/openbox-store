import FoundItems from "@/components/ZheZhemon/FoundItems/FoundItems";
import AddNewSearchForm from "@/components/ZheZhemon/SearchForm/AddNewSearchForm";

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
