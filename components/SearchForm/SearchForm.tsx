'use client'

import { useTransition } from 'react'
import { useRealtimeSearches } from '@/hooks/useRealtimeSearches'
import { updateSearch } from '@/app/actions/updateSearchAction'

export default function SearchForm({ searchId }: { searchId: number | undefined }) {
    const search = useRealtimeSearches(searchId)[0]
    const [isPending, startTransition] = useTransition()

    if (!search) return <div>Loading...</div>

    return (
        <form
            action={(formData) => {
                startTransition(() => updateSearch(formData))
            }}
            className="search-form"
        >
            <input type="hidden" name="id" value={search.id} />

            <label>
                Keywords:
                <input type="text" name="keywords" defaultValue={search.keywords} />
            </label>

            <label>
                Model:
                <input type="text" name="model" defaultValue={search.model} />
            </label>

            <label>
                Min Price:
                <input type="number" name="minprice" defaultValue={search.minprice} />
            </label>

            <label>
                Max Price:
                <input type="number" name="maxprice" defaultValue={search.maxprice} />
            </label>

            <label>
                Brand:
                <input type="text" name="brand" defaultValue={search.brand} />
            </label>

            <label>
                Seller:
                <input type="text" name="seller" defaultValue={search.seller} />
            </label>

            <button type="submit" disabled={isPending}>
                {isPending ? 'Saving...' : 'Save'}
            </button>
        </form>
    )
}