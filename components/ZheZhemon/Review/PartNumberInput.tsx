'use client'
import {useEffect,useId,useRef,useState} from 'react'
import type {CatalogMatch} from '@/lib/reviewBoards'
import styles from './Boards.module.css'

const DEBOUNCE_MS=300

/**
 * Part-number input with the CRM catalog picker: typing offers catalog products
 * like the purchase form does, picking one fills in its model number. Free text
 * stays possible for products the catalog does not have yet.
 */
export default function PartNumberInput({value,onChange,disabled,placeholder,invalid}:{value:string;onChange:(value:string)=>void;
    disabled?:boolean;placeholder?:string;invalid?:boolean}) {
    const [matches,setMatches]=useState<CatalogMatch[]>([]),[open,setOpen]=useState(false),[active,setActive]=useState(-1),[state,setState]=useState<'idle'|'loading'|'empty'|'error'>('idle')
    const typed=useRef(false),listId=useId()
    const term=value.trim()
    useEffect(()=>{
        // Only what the person typed searches; a picked or reset value does not.
        if(!typed.current || term.length<2){setMatches([]);setState('idle');return}
        const abort=new AbortController()
        const timer=setTimeout(async()=>{
            setState('loading')
            try {
                const res=await fetch(`/api/review/catalog-search?${new URLSearchParams({q:term})}`,{signal:abort.signal,cache:'no-store'})
                // 503: search is not configured here, so the field stays a plain input.
                if(res.status===503){setMatches([]);setState('idle');return}
                if(!res.ok)throw new Error(String(res.status))
                const data=await res.json() as {items:CatalogMatch[]}
                setMatches(data.items);setActive(-1);setState(data.items.length?'idle':'empty')
            } catch { if(!abort.signal.aborted){setMatches([]);setState('error')} }
        },DEBOUNCE_MS)
        return ()=>{abort.abort();clearTimeout(timer)}
    },[term])
    function pick(match:CatalogMatch){typed.current=false;onChange(match.modelNumber);setOpen(false);setMatches([])}
    const shown=open && term.length>=2 && (matches.length>0 || state!=='idle')
    return <div className={styles.partNumberPicker}>
        <input value={value} disabled={disabled} maxLength={64} placeholder={placeholder} aria-invalid={invalid} autoComplete="off" spellCheck={false}
            role="combobox" aria-expanded={shown} aria-controls={listId} aria-autocomplete="list"
            aria-activedescendant={shown && active>=0?`${listId}-${active}`:undefined}
            onChange={e=>{typed.current=true;setOpen(true);onChange(e.target.value)}}
            onFocus={()=>setOpen(true)} onBlur={()=>setOpen(false)}
            onKeyDown={e=>{
                if(!shown || !matches.length)return
                if(e.key==='ArrowDown'){e.preventDefault();setActive(i=>(i+1)%matches.length)}
                else if(e.key==='ArrowUp'){e.preventDefault();setActive(i=>(i<=0?matches.length:i)-1)}
                else if(e.key==='Enter' && active>=0){e.preventDefault();pick(matches[active])}
                else if(e.key==='Escape'){e.preventDefault();setOpen(false)}
            }}/>
        {shown && <ul id={listId} role="listbox" className={styles.partNumberOptions}>
            {state==='loading' && !matches.length && <li className={styles.muted}>Шукаю в ERP…</li>}
            {state==='empty' && <li className={styles.muted}>У каталозі ERP не знайдено — можна зберегти як є</li>}
            {state==='error' && <li className={styles.muted}>ERP недоступна — можна ввести номер вручну</li>}
            {state!=='error' && matches.map((match,i)=><li key={match.id} id={`${listId}-${i}`} role="option" aria-selected={i===active}
                // mousedown, not click: the input's blur would close the list first.
                onMouseDown={e=>{e.preventDefault();pick(match)}} onMouseEnter={()=>setActive(i)}>
                <b>{match.modelNumber}</b> <span>{match.fullName ?? match.name ?? ''}</span>
            </li>)}
        </ul>}
    </div>
}
