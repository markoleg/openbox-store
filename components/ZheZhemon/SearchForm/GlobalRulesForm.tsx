'use client'

import { useRef, useState, useTransition } from 'react'
import { Globe } from 'lucide-react'
import { toast } from 'react-toastify'
import { saveGlobalRules } from '@/actions/globalRulesAction'
import FiltersFieldset, { type SearchFilters } from './FiltersFieldset'
import styles from './SearchForm.module.css'

/**
 * Rules applied to every search on top of its own: stop and must words add up,
 * a search's own part-number rule wins over a global one, and its variant rules
 * are tried before the global ones. The parser picks a save up within a minute.
 */
export default function GlobalRulesForm({ initial }: { initial: { filters: SearchFilters; version: number } | null }) {
    const [open, setOpen] = useState(false)
    const [current, setCurrent] = useState(initial)
    const [isPending, startTransition] = useTransition()
    // One id per edit, so a retried submit is the same save, not a second one.
    const command = useRef(crypto.randomUUID())
    const ruleCount = current ? countRules(current.filters) : 0

    return (
        <div className={`${styles.form_wrp} ${open ? styles.open : ''}`}>
            <h2 onClick={() => setOpen(!open)} className={styles.form_title}>
                <span>Глобальні правила{ruleCount ? ` · ${ruleCount}` : ''}</span>
                <Globe />
            </h2>
            {!current ? <p className={styles.filterHint}>Глобальні правила недоступні: потрібна міграція 034 у базі.</p> :
            <form
                className={styles.form}
                action={(formData) => {
                    formData.set('version', String(current.version))
                    formData.set('commandId', command.current)
                    startTransition(async () => {
                        const { error, result } = await saveGlobalRules(formData)
                        if (error || !result) { toast.error(error ?? 'Не вдалося зберегти'); return }
                        command.current = crypto.randomUUID()
                        setCurrent({ filters: result.filters, version: result.version })
                        if (result.status === 'conflict') toast.warning('Правила вже змінили в іншому вікні — показую поточні, перевір і збережи ще раз')
                        else if (result.status === 'noop') toast.info('Без змін')
                        else toast.success('Збережено. Парсер підхопить протягом хвилини')
                    })
                }}
            >
                <p className={styles.filterHint}>
                    Діють на всі пошуки разом з їхніми власними правилами: стоп- і обов&apos;язкові слова
                    додаються, правило пошуку для того самого партійного перебиває глобальне, а варіантні
                    правила пошуку перевіряються раніше за глобальні.
                </p>
                {/* Remount on every new version so the editor shows exactly what is stored. */}
                <FiltersFieldset key={current.version} value={current.filters} scope="global" />
                <button type="submit" disabled={isPending}>{isPending ? 'Зберігаю…' : 'Зберегти глобальні правила'}</button>
            </form>}
        </div>
    )
}

function countRules(filters: SearchFilters): number {
    return (filters.stop_words?.length ?? 0) + (filters.must_words?.length ?? 0)
        + (filters.variant_rules?.length ?? 0) + Object.keys(filters.mpn_rules ?? {}).length
}
