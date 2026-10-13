import {searchLabel} from '@/lib/reviewBoards'

/** The search that found the listing, linked to its page; a deleted search stays plain text. */
export default function SearchLink({card}:{card:{search_id:number|null;search_name:string|null}}) {
    const label=searchLabel(card)
    if(card.search_id===null)return <span>{label}</span>
    // A new tab keeps the queue and its scroll position where they were.
    return <a href={`/zhezhemon/${card.search_id}`} target="_blank" rel="noopener" title="Відкрити пошук">{label}</a>
}
