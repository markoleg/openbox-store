'use client'

import { useTransition, useState, useEffect } from 'react'
import styles from './SearchForm.module.css'
import { SquarePlus } from 'lucide-react'
import { addSearch } from '@/actions/addSearchAction'

export default function AddNewSearchForm() {
    const [openForm, setOpenForm] = useState(false)
    const toggleForm = () => {
        setOpenForm(!openForm)
    }
    const [isPending, startTransition] = useTransition()
    const [moreAspects, setMoreAspects] = useState<{ key: string; value: string }[]>([])
    const [bannedLinks, setBannedLinks] = useState<string[]>([])


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

                    Add New Search
                </span>
                <SquarePlus />
            </h2>
            <form
                action={(formData) => {
                    bannedLinks.forEach((link, index) => {
                        formData.append(`banned_link_${index}`, link)
                    })
                    startTransition(() => addSearch(formData))
                }}
                className={styles.form}
            >
                <input type="hidden" name="id" />

                <label>
                    Category Id:
                    <input type="text" name="categoryid" />
                </label>

                <label>
                    Keywords:
                    <input type="text" name="keywords" />
                </label>

                <label>
                    Brand:
                    <input type="text" name="brand" />
                </label>

                <label>
                    Model:
                    <input type="text" name="model" />
                </label>

                <label>
                    Condition Id:
                    <input type="text" name="condition" />
                </label>

                <label>
                    Min Price:
                    <input type="number" name="minprice" />
                </label>

                <label>
                    Max Price:
                    <input type="number" name="maxprice" />
                </label>

                <label>
                    Rate:
                    <input type="text" name="rate" />
                </label>

                <label>
                    Seller:
                    <input type="text" name="seller" />
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


                <button type="submit" disabled={isPending}>
                    {isPending ? 'Adding...' : 'Add New Search'}
                </button>
            </form>
        </div>

    )
}
