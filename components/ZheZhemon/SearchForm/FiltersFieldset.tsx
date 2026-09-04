'use client'

import { useState } from 'react'
import styles from './SearchForm.module.css'

/** Shape of the `filters` jsonb column. Mirrors zhezhemon/filters.py. */
export interface SearchFilters {
    stop_words?: string[]
    must_words?: string[]
    variant_rules?: VariantRuleJson[]
    mpn_rules?: Record<string, { cap?: number; skip?: boolean }>
    use_short_description?: boolean
}

export interface VariantRuleJson {
    name?: string
    match?: string[]
    cap?: number
    skip?: boolean
    default?: boolean
}

/** A rule while it is being edited: numbers stay strings so a cleared input
 *  stays cleared instead of collapsing to 0. */
interface RuleDraft {
    name: string
    match: string
    cap: string
    skip: boolean
    isDefault: boolean
}

interface MpnDraft {
    mpn: string
    cap: string
    skip: boolean
}

function toRuleDrafts(rules?: VariantRuleJson[]): RuleDraft[] {
    return (rules ?? []).map((rule) => ({
        name: rule.name ?? '',
        match: (rule.match ?? []).join(', '),
        cap: rule.cap == null ? '' : String(rule.cap),
        skip: Boolean(rule.skip),
        isDefault: Boolean(rule.default),
    }))
}

function toMpnDrafts(rules?: SearchFilters['mpn_rules']): MpnDraft[] {
    return Object.entries(rules ?? {}).map(([mpn, rule]) => ({
        mpn,
        cap: rule.cap == null ? '' : String(rule.cap),
        skip: Boolean(rule.skip),
    }))
}

const splitWords = (value: string) =>
    value.split(',').map((word) => word.trim()).filter(Boolean)

/**
 * Serialise the drafts back to the column.
 *
 * Empty keys are left out entirely, so an untouched form saves `{}` - and an
 * empty object is what the tracker reads as "behave exactly as before".
 */
function buildFilters(
    stopWords: string[],
    mustWords: string[],
    rules: RuleDraft[],
    mpnRules: MpnDraft[],
    useShortDescription: boolean
): SearchFilters {
    const filters: SearchFilters = {}

    const stop = stopWords.map((w) => w.trim()).filter(Boolean)
    if (stop.length) filters.stop_words = stop

    const must = mustWords.map((w) => w.trim()).filter(Boolean)
    if (must.length) filters.must_words = must

    const variants: VariantRuleJson[] = []
    for (const draft of rules) {
        const match = splitWords(draft.match)
        // A rule with nothing to match on can never fire; dropping it keeps
        // half-filled rows from being saved as dead weight.
        if (!match.length && !draft.isDefault) continue

        const rule: VariantRuleJson = {}
        if (draft.name.trim()) rule.name = draft.name.trim()
        if (draft.isDefault) rule.default = true
        else rule.match = match
        if (draft.skip) rule.skip = true
        else if (draft.cap.trim()) rule.cap = Number(draft.cap)
        variants.push(rule)
    }
    if (variants.length) filters.variant_rules = variants

    const mpn: SearchFilters['mpn_rules'] = {}
    for (const draft of mpnRules) {
        const key = draft.mpn.trim().toUpperCase()
        if (!key) continue
        mpn[key] = draft.skip
            ? { skip: true }
            : draft.cap.trim()
            ? { cap: Number(draft.cap) }
            : {}
    }
    if (Object.keys(mpn).length) filters.mpn_rules = mpn

    if (useShortDescription) filters.use_short_description = true

    return filters
}

interface Props {
    value?: SearchFilters | null
    /** The search's own Max Price, to flag caps that can never fire. */
    maxPrice?: number | string
}

/**
 * Editor for the per-search listing filters, shared by the add and edit forms.
 *
 * Everything is submitted as one hidden JSON field rather than the indexed
 * `name_${i}` inputs the older fieldsets use: a variant rule is a nested object
 * with four parts, and flattening that into parallel indexed fields would put
 * the burden of reassembling it on both server actions.
 */
export default function FiltersFieldset({ value, maxPrice }: Props) {
    const [stopWords, setStopWords] = useState<string[]>(value?.stop_words ?? [])
    const [mustWords, setMustWords] = useState<string[]>(value?.must_words ?? [])
    const [rules, setRules] = useState<RuleDraft[]>(toRuleDrafts(value?.variant_rules))
    const [mpnRules, setMpnRules] = useState<MpnDraft[]>(toMpnDrafts(value?.mpn_rules))
    const [useShortDescription, setUseShortDescription] = useState(
        Boolean(value?.use_short_description)
    )

    const serialised = JSON.stringify(
        buildFilters(stopWords, mustWords, rules, mpnRules, useShortDescription)
    )

    const ceiling = maxPrice == null || maxPrice === '' ? null : Number(maxPrice)
    const capTooHigh = (cap: string) =>
        ceiling != null && cap.trim() !== '' && Number(cap) > ceiling

    const updateWord = (
        list: string[],
        setList: (next: string[]) => void,
        index: number,
        next: string
    ) => setList(list.map((word, i) => (i === index ? next : word)))

    const renderWordList = (
        legend: string,
        hint: string,
        list: string[],
        setList: (next: string[]) => void,
        placeholder: string
    ) => (
        <fieldset className={styles.filterGroup}>
            <legend>{legend}</legend>
            <p className={styles.filterHint}>{hint}</p>
            {list.map((word, index) => (
                <div key={index}>
                    <input
                        type="text"
                        placeholder={placeholder}
                        value={word}
                        onChange={(e) => updateWord(list, setList, index, e.target.value)}
                    />
                    <button
                        type="button"
                        onClick={() => setList(list.filter((_, i) => i !== index))}
                    >
                        ✖
                    </button>
                </div>
            ))}
            <button type="button" onClick={() => setList([...list, ''])}>
                + Add
            </button>
        </fieldset>
    )

    return (
        <>
            <input type="hidden" name="filters" value={serialised} />

            {renderWordList(
                'Stop Words',
                'Hidden if the title contains any of these. Substring match, case-insensitive: "se 2" also catches "SE 2nd Gen". Mind the spacing - "se 3" does not match "SE3".',
                stopWords,
                setStopWords,
                'lcd'
            )}

            {renderWordList(
                'Must Words',
                'Hidden unless the title contains every one of these.',
                mustWords,
                setMustWords,
                'se 3'
            )}

            <fieldset className={styles.filterGroup}>
                <legend>Variant Rules</legend>
                <p className={styles.filterHint}>
                    A price ceiling per variant. First matching rule wins, so put the
                    narrower one first — <code>rose gold</code> above <code>gold</code>.
                    A rule only fires when its words are in the title: a listing that
                    names no colour is left alone rather than judged by the cheapest cap.
                </p>
                {rules.map((rule, index) => (
                    <div key={index}>
                        <input
                            type="text"
                            placeholder="Label (optional)"
                            value={rule.name}
                            onChange={(e) =>
                                setRules(
                                    rules.map((r, i) =>
                                        i === index ? { ...r, name: e.target.value } : r
                                    )
                                )
                            }
                        />
                        <input
                            type="text"
                            placeholder={rule.isDefault ? 'everything else' : 'midnight'}
                            title="All words must appear in the title. Comma separated."
                            disabled={rule.isDefault}
                            value={rule.match}
                            onChange={(e) =>
                                setRules(
                                    rules.map((r, i) =>
                                        i === index ? { ...r, match: e.target.value } : r
                                    )
                                )
                            }
                        />
                        <input
                            type="number"
                            step="0.01"
                            placeholder="Cap"
                            title="Total price, shipping included, above which this variant is hidden."
                            disabled={rule.skip}
                            value={rule.cap}
                            onChange={(e) =>
                                setRules(
                                    rules.map((r, i) =>
                                        i === index ? { ...r, cap: e.target.value } : r
                                    )
                                )
                            }
                        />
                        <label className={styles.filterCheck}>
                            <input
                                type="checkbox"
                                checked={rule.skip}
                                onChange={(e) =>
                                    setRules(
                                        rules.map((r, i) =>
                                            i === index ? { ...r, skip: e.target.checked } : r
                                        )
                                    )
                                }
                            />
                            never show
                        </label>
                        <button
                            type="button"
                            onClick={() => setRules(rules.filter((_, i) => i !== index))}
                        >
                            ✖
                        </button>
                        {!rule.skip && capTooHigh(rule.cap) && (
                            <p className={styles.filterWarning}>
                                Cap is above Max Price ({ceiling}), so it can never fire —
                                eBay never returns anything dearer.
                            </p>
                        )}
                    </div>
                ))}
                <button
                    type="button"
                    onClick={() =>
                        setRules([
                            ...rules,
                            { name: '', match: '', cap: '', skip: false, isDefault: false },
                        ])
                    }
                >
                    + Add Rule
                </button>
            </fieldset>

            <fieldset className={styles.filterGroup}>
                <legend>Part Number Rules</legend>
                <p className={styles.filterHint}>
                    Wins over the variant rules above, but only fires when the part number
                    is written in the title — roughly one listing in five. Matched by
                    prefix, longest first: <code>MTJV3</code> covers every region of the
                    same product, <code>MTJV3LL/A</code> pins down one.
                </p>
                {mpnRules.map((rule, index) => (
                    <div key={index}>
                        <input
                            type="text"
                            placeholder="MEH34"
                            value={rule.mpn}
                            onChange={(e) =>
                                setMpnRules(
                                    mpnRules.map((r, i) =>
                                        i === index ? { ...r, mpn: e.target.value } : r
                                    )
                                )
                            }
                        />
                        <input
                            type="number"
                            step="0.01"
                            placeholder="Cap"
                            disabled={rule.skip}
                            value={rule.cap}
                            onChange={(e) =>
                                setMpnRules(
                                    mpnRules.map((r, i) =>
                                        i === index ? { ...r, cap: e.target.value } : r
                                    )
                                )
                            }
                        />
                        <label className={styles.filterCheck}>
                            <input
                                type="checkbox"
                                checked={rule.skip}
                                onChange={(e) =>
                                    setMpnRules(
                                        mpnRules.map((r, i) =>
                                            i === index ? { ...r, skip: e.target.checked } : r
                                        )
                                    )
                                }
                            />
                            never show
                        </label>
                        <button
                            type="button"
                            onClick={() =>
                                setMpnRules(mpnRules.filter((_, i) => i !== index))
                            }
                        >
                            ✖
                        </button>
                        {!rule.skip && capTooHigh(rule.cap) && (
                            <p className={styles.filterWarning}>
                                Cap is above Max Price ({ceiling}), so it can never fire.
                            </p>
                        )}
                    </div>
                ))}
                <button
                    type="button"
                    onClick={() => setMpnRules([...mpnRules, { mpn: '', cap: '', skip: false }])}
                >
                    + Add Part Number
                </button>
            </fieldset>

            <fieldset className={styles.filterGroup}>
                <legend>Matching</legend>
                <label className={styles.filterCheck}>
                    <input
                        type="checkbox"
                        checked={useShortDescription}
                        onChange={(e) => setUseShortDescription(e.target.checked)}
                    />
                    Also search eBay&apos;s short description
                </label>
                <p className={styles.filterHint}>
                    Off by default. It is free text written by the seller, so a “Midnight
                    Sport Band” on a Starlight case would match the Midnight rule. Part
                    numbers are always read from the title only.
                </p>
            </fieldset>
        </>
    )
}
