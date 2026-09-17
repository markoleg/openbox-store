'use client'

import { useTransition, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-toastify'
import { useRealtimeSearches } from '@/hooks/useRealtimeSearches'
import { explainError, saveSearch } from '@/lib/reviewClient'
import { searchConfigFromForm } from '@/lib/searchConfig'
import styles from './SearchForm.module.css'
import { Loader, Settings } from 'lucide-react'
import { deleteSearch } from '@/actions/deleteSearchAction'
import FiltersFieldset from './FiltersFieldset'

export default function SearchForm({ searchId }: { searchId: number | undefined }) {
    const search = useRealtimeSearches(searchId)[0]
    const router = useRouter()
    const [openForm, setOpenForm] = useState(false)
    const toggleForm = () => {
        setOpenForm(!openForm)
    }
    const [isPending, startTransition] = useTransition()
    const [moreAspects, setMoreAspects] = useState<{ key: string; value: string }[]>([])
    const [bannedLinks, setBannedLinks] = useState<string[]>([])
    // What the server had when the list was loaded. Save sends only the
    // difference, so a Ban made from Telegram meanwhile is never overwritten.
    const [baselineBanned, setBaselineBanned] = useState<string[]>([])
    const [baselineVersion, setBaselineVersion] = useState<number | null>(null)

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
        if (!search) return
        const banned = search.banned ?? []
        setBannedLinks(banned)
        setBaselineBanned(banned)
        setBaselineVersion(search.review_version ?? null)
    }, [search?.id, search?.review_version]) // eslint-disable-line react-hooks/exhaustive-deps
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
                    const edited = Array.from(new Set(bannedLinks.map(l => l.trim()).filter(Boolean)))
                    const ban = edited.filter(l => !baselineBanned.includes(l))
                    const unban = baselineBanned.filter(l => !edited.includes(l))
                    startTransition(async () => {
                        try {
                            const result = await saveSearch({
                                searchId: search.id, expectedVersion: baselineVersion,
                                config: searchConfigFromForm(formData), ban, unban,
                            })
                            if (result.status === 'conflict' && result.current) {
                                // Someone (Telegram, another tab) changed this search first.
                                const current = result.current as { banned?: string[] | null; review_version?: number }
                                setBannedLinks(current.banned ?? [])
                                setBaselineBanned(current.banned ?? [])
                                setBaselineVersion(current.review_version ?? null)
                                toast.warn('Пошук уже змінено в іншому місці — список банів оновлено, перевір і збережи ще раз')
                                return
                            }
                            if (result.status === 'rejected') { toast.error('Пошук видалено'); return }
                            if (result.status === 'noop') { toast.info('Без змін'); return }
                            setBaselineBanned(result.banned ?? edited)
                            setBaselineVersion(result.reviewVersion ?? null)
                            toast.success(`Збережено${result.reactions ? ` · банів/розбанів: ${result.reactions}` : ''}`)
                        } catch (error) {
                            toast.error(explainError(error))
                        }
                    })
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

                <details className={styles.bannedLinks}>
                    <summary className={styles.bannedLinksSummary}>
                        Banned Links
                        <span className={styles.bannedLinksCount}>{bannedLinks.length}</span>
                    </summary>

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
                </details>

                <FiltersFieldset value={search.filters} maxPrice={search.maxprice} />

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
                        startTransition(async () => {
                            // A search the database refuses to drop used to fail
                            // in the server log only, so the button looked dead.
                            const { error } = await deleteSearch(search.id, crypto.randomUUID())
                            if (error) {
                                toast.error(`Can't delete this search: ${error}`)
                                return
                            }
                            router.push('/zhezhemon')
                        })
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
