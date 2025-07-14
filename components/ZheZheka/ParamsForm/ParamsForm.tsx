'use client'

import { useTransition, useState, useEffect, useRef } from 'react'
import { Loader, Settings } from 'lucide-react'
import { supabase } from "@/lib/SupaBaseClient";
import styles from './ParamsForm.module.css'

export interface ZZKParams {
    id: number;
    keywords: string[];
    stat_keys: string[]; // new parameter
    minuskeys: string[];
    minususers: string[];
}

export default function ZZKParamsForm() {
    const [isOpen, setIsOpen] = useState(false)
    const toggle = () => setIsOpen(!isOpen)
    const [params, setParams] = useState<ZZKParams>({} as ZZKParams)
    const [isPending, startTransition] = useTransition()
    const [keywords, setKeywords] = useState<string[]>([])
    const [minuskeys, setMinuskeys] = useState<string[]>([])
    const [minususers, setMinususers] = useState<string[]>([])
    const keywordRefs = useRef<(HTMLInputElement | null)[]>([])
    const minuskeyRefs = useRef<(HTMLInputElement | null)[]>([])
    const minususerRefs = useRef<(HTMLInputElement | null)[]>([])
    const [statKeys, setStatKeys] = useState<string[]>([])
    const statKeyRefs = useRef<(HTMLInputElement | null)[]>([])
    useEffect(() => {
        const fetchParams = async () => {
            let query = supabase
                .from("zzk_params")
                .select("*")
                .limit(1)
            const { data, error } = await query;
            if (data) {
                setParams(data[0])
            }
        }
        fetchParams()
    }, [])
    useEffect(() => {
        if (params?.keywords) {
            setKeywords(params.keywords)
        }
    }, [params])
    useEffect(() => {
        if (params?.minuskeys) {
            setMinuskeys(params.minuskeys)
        }
    }, [params])
    useEffect(() => {
        if (params?.minususers) {
            setMinususers(params.minususers)
        }
    }, [params])
    useEffect(() => {
        if (params?.stat_keys) {
            setStatKeys(params.stat_keys)
        }
    }, [params])

    if (!params.id) return <Loader color='var(--primary)' className='loader' />

    const handleAddKeyword = () => {
        setKeywords((prev) => {
            const updated = [...prev, '']
            // Дочекайся рендера і постав курсор
            setTimeout(() => {
                const lastRef = keywordRefs.current[updated.length - 1]
                lastRef?.focus()
            }, 0)
            return updated
        })
    }

    const handleRemoveKeyword = (index: number) => {
        setKeywords(keywords.filter((_, i) => i !== index))
    }

    const handleKeywordsChange = (index: number, value: string) => {
        const updated = [...keywords]
        updated[index] = value
        setKeywords(updated)
    }
    const handleAddMinusKey = () => {
        setMinuskeys((prev) => {
            const updated = [...prev, '']
            // Дочекайся рендера і постав курсор
            setTimeout(() => {
                const lastRef = minuskeyRefs.current[updated.length - 1]
                lastRef?.focus()
            }, 0)
            return updated
        })
    }

    const handleRemoveMinusKey = (index: number) => {
        setMinuskeys(minuskeys.filter((_, i) => i !== index))
    }

    const handleMinusKeysChange = (index: number, value: string) => {
        const updated = [...minuskeys]
        updated[index] = value
        setMinuskeys(updated)
    }
    const handleAddMinusUser = () => {
        setMinususers((prev) => {
            const updated = [...prev, '']
            // Дочекайся рендера і постав курсор
            setTimeout(() => {
                const lastRef = minususerRefs.current[updated.length - 1]
                lastRef?.focus()
            }, 0)
            return updated
        })
    }
    const handleRemoveMinusUser = (index: number) => {
        setMinususers(minususers.filter((_, i) => i !== index))
    }
    const handleMinusUsersChange = (index: number, value: string) => {
        const updated = [...minususers]
        updated[index] = value
        setMinususers(updated)
    }
    const handleAddStatKey = () => {
        setStatKeys((prev) => {
            const updated = [...prev, '']
            setTimeout(() => {
                const lastRef = statKeyRefs.current[updated.length - 1]
                lastRef?.focus()
            }, 0)
            return updated
        })
    }

    const handleRemoveStatKey = (index: number) => {
        setStatKeys(statKeys.filter((_, i) => i !== index))
    }

    const handleStatKeysChange = (index: number, value: string) => {
        const updated = [...statKeys]
        updated[index] = value
        setStatKeys(updated)
    }
    const handleSave = async () => {
        startTransition(async () => {
            const cleanKeywords = keywords.map(k => k.trim()).filter(k => k !== '')
            const cleanStatKeys = statKeys.map(k => k.trim()).filter(k => k !== '')
            const cleanMinuskeys = minuskeys.map(k => k.trim()).filter(k => k !== '')
            const cleanMinususers = minususers.map(k => k.trim()).filter(k => k !== '')

            const { data, error } = await supabase
                .from("zzk_params")
                .update({
                    keywords: cleanKeywords,
                    stat_keys: cleanStatKeys,
                    minuskeys: cleanMinuskeys,
                    minususers: cleanMinususers
                })
                .eq("id", params.id)

            if (error) {
                console.error('Error updating params:', error)
            } else {
                if (data) {
                    setParams(data[0])
                }
                console.log('Params updated successfully:', data)
            }
        })
    }



    return (
        <div className={`${styles.form_wrp} ${isOpen ? styles.open : ''}`}>
            <h2
                className={styles.title}
                onClick={toggle}>
                Params Form
                <Settings onClick={toggle} className={styles.settings} />
            </h2>
            <form action="" className={styles.form}>
                <fieldset >
                    <legend>Keywords</legend>

                    {keywords.map((keyword, index) => (
                        <div key={index} >
                            <input
                                type="text"
                                name={`keyword_${index}`}
                                placeholder="Enter keyword"
                                value={keyword}
                                onChange={(e) => handleKeywordsChange(index, e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault()
                                        handleAddKeyword()

                                    }
                                }}
                                ref={(el) => { keywordRefs.current[index] = el; }}
                            />
                            <button type="button" onClick={() => handleRemoveKeyword(index)}>
                                ✖
                            </button>
                        </div>
                    ))}

                    <button type="button" onClick={handleAddKeyword}>
                        + Add keyword
                    </button>
                </fieldset>
                <fieldset >
                    <legend>Stat Keys</legend>

                    {statKeys.map((statKey, index) => (
                        <div key={index} >
                            <input
                                type="text"
                                name={`stat_key_${index}`}
                                placeholder="Enter stat key"
                                value={statKey}
                                onChange={(e) => handleStatKeysChange(index, e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault()
                                        handleAddStatKey()
                                    }
                                }}
                                ref={(el) => { statKeyRefs.current[index] = el; }}
                            />
                            <button type="button" onClick={() => handleRemoveStatKey(index)}>
                                ✖
                            </button>
                        </div>
                    ))}

                    <button type="button" onClick={handleAddStatKey}>
                        + Add stat key
                    </button>
                </fieldset>
                <fieldset >
                    <legend>Minus Keywords</legend>

                    {minuskeys.map((keyword, index) => (
                        <div key={index} >
                            <input
                                type="text"
                                name={`banned_link_${index}`}
                                placeholder="Enter keyword"
                                value={keyword}
                                onChange={(e) => handleMinusKeysChange(index, e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault()
                                        handleAddMinusKey()
                                    }
                                }}
                                ref={(el) => { minuskeyRefs.current[index] = el; }}
                            />
                            <button type="button" onClick={() => handleRemoveMinusKey(index)}>
                                ✖
                            </button>
                        </div>
                    ))}

                    <button type="button" onClick={handleAddMinusKey}>
                        + Add minus keyword
                    </button>
                </fieldset>
                <fieldset >
                    <legend>Minus Users</legend>

                    {minususers.map((keyword, index) => (
                        <div key={index} >
                            <input
                                type="text"
                                name={`banned_link_${index}`}
                                placeholder="Enter keyword"
                                value={keyword}
                                onChange={(e) => handleMinusUsersChange(index, e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault()
                                        handleAddMinusUser()
                                    }
                                }}
                                ref={(el) => { minususerRefs.current[index] = el; }}
                            />
                            <button type="button" onClick={() => handleRemoveMinusUser(index)}>
                                ✖
                            </button>
                        </div>
                    ))}

                    <button type="button" onClick={handleAddMinusUser}>
                        + Add minus user
                    </button>
                </fieldset>
                <button type='submit' onClick={handleSave}
                    disabled={isPending}>
                    {isPending ? 'Saving...' : 'Save'}
                </button>
            </form>
        </div>
    )
}