'use client'

import { useTransition, useState, useEffect } from 'react'
import { useRealtimeSearches } from '@/hooks/useRealtimeSearches'
import { updateSearch } from '@/actions/updateSearchAction'
import styles from './SearchForm.module.css'
import { Loader, Settings, SquareArrowUp } from 'lucide-react'
import { deleteSearch } from '@/actions/deleteSearchAction'

export default function SearchForm({ searchId }: { searchId: number | undefined }) {
    const search = useRealtimeSearches(searchId)[0]
    const [openForm, setOpenForm] = useState(false)
    const toggleForm = () => {
        setOpenForm(!openForm)
    }
    const [isPending, startTransition] = useTransition()
    const [moreAspects, setMoreAspects] = useState<{ key: string; value: string }[]>([])
    const [bannedLinks, setBannedLinks] = useState<string[]>([])

    useEffect(() => {
        if (search?.more_aspects) {
            const parsed = (search.more_aspects as string[]).map((item) => {
                const [key, value] = item.split(':')
                return { key: key?.trim() || '', value: value?.trim() || '' }
            })
            setMoreAspects(parsed)
        }
    }, [search])
    useEffect(() => {
        if (search?.banned) {
            setBannedLinks(search.banned)
        }
    }, [search])
    if (!search) return <Loader color='var(--primary)' className='loader' />

    const handleAddAspect = () => {
        setMoreAspects([...moreAspects, { key: '', value: '' }])
    }

    const handleRemoveAspect = (index: number) => {
        setMoreAspects(moreAspects.filter((_, i) => i !== index))
    }

    const handleAspectChange = (index: number, field: 'key' | 'value', value: string) => {
        const updated = [...moreAspects]
        updated[index][field] = value
        setMoreAspects(updated)
    }
    const handleAddBannedLink = () => {
        setBannedLinks([...bannedLinks, ''])
    }

    const handleRemoveBannedLink = (index: number) => {
        setBannedLinks(bannedLinks.filter((_, i) => i !== index))
    }

    const handleBannedLinkChange = (index: number, value: string) => {
        const updated = [...bannedLinks]
        updated[index] = value
        setBannedLinks(updated)
    }
    return (
        <div className={`${styles.form_wrp} ${openForm ? styles.open : ''}`} >
            <h2 onClick={toggleForm} className={styles.form_title}>
                <span>

                    Search Parameters
                </span>
                <Settings />
            </h2>
            <form
                action={(formData) => {
                    bannedLinks.forEach((link, index) => {
                        formData.append(`banned_link_${index}`, link)
                    })
                    startTransition(() => updateSearch(formData))
                }}
                className={styles.form}
            >
                <input type="hidden" name="id" value={search.id} />

                <label>
                    Category Id:
                    <input type="text" name="categoryid" defaultValue={search.categoryid} />
                </label>

                <label>
                    Keywords:
                    <input type="text" name="keywords" defaultValue={search.keywords} />
                </label>

                <label>
                    Brand:
                    <input type="text" name="brand" defaultValue={search.brand} />
                </label>

                <label>
                    Model:
                    <input type="text" name="model" defaultValue={search.model} />
                </label>

                <label>
                    Condition Id:
                    <input type="text" name="condition" defaultValue={search.condition} />
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
                    Rate:
                    <input type="text" name="rate" defaultValue={search.rate} />
                </label>

                <label>
                    Seller:
                    <input type="text" name="seller" defaultValue={search.seller} />
                </label>

                <fieldset className={styles.bannedLinks}>
                    <legend>Banned Links</legend>

                    {bannedLinks.map((link, index) => (
                        <div key={index} className={styles.bannedLinkItem}>
                            <input
                                type="text"
                                name={`banned_link_${index}`}
                                placeholder="Enter link"
                                value={link}
                                onChange={(e) => handleBannedLinkChange(index, e.target.value)}
                            />
                            <button type="button" onClick={() => handleRemoveBannedLink(index)}>
                                ✖
                            </button>
                        </div>
                    ))}

                    <button type="button" onClick={handleAddBannedLink}>
                        + Add Link
                    </button>
                </fieldset>

                {/* More Aspects */}
                <fieldset className={styles.moreAspects}>
                    <legend>More Aspects</legend>

                    {moreAspects.map((aspect, index) => (
                        <div key={index} className={styles.aspectPair}>
                            <input
                                type="text"
                                name={`aspect_key_${index}`}
                                placeholder="Key"
                                value={aspect.key}
                                onChange={(e) => handleAspectChange(index, 'key', e.target.value)}
                            />
                            <input
                                type="text"
                                name={`aspect_value_${index}`}
                                placeholder="Value"
                                value={aspect.value}
                                onChange={(e) => handleAspectChange(index, 'value', e.target.value)}
                            />
                            <button type="button" onClick={() => handleRemoveAspect(index)}>
                                ✖
                            </button>
                        </div>
                    ))}

                    <button type="button" onClick={handleAddAspect}>
                        + Add Aspect
                    </button>
                </fieldset>
                <button
                    type='button'
                    onClick={() => {
                        // ask for confirmation before deleting
                        const confirmDelete = confirm('Are you sure you want to delete this search?')
                        if (!confirmDelete) return
                        deleteSearch(search.id)
                    }}
                    className={styles.delete_btn}
                >
                    Delete
                </button>

                <button type="submit" disabled={isPending}>
                    {isPending ? 'Saving...' : 'Save'}
                </button>
            </form>
        </div>

    )
}
