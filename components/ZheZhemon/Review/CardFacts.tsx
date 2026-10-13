import {listingFactsLabel,marginNote,type CardListingFacts} from '@/lib/reviewBoards'
import styles from './Boards.module.css'

// Inlined at build time; without it «немає ціни» stays plain text.
const CRM_URL=process.env.NEXT_PUBLIC_OPENBOX_CRM_URL

/** Condition, seller and CRM margin under the title, as the Telegram message shows them. */
export default function CardFacts({card}:{card:CardListingFacts}) {
    const facts=listingFactsLabel(card),margin=marginNote(card,CRM_URL)
    if(!facts && !margin)return null
    return <p className={styles.listingFacts}>
        {facts}{facts && margin && ' · '}
        {margin && (margin.href
            ?<a href={margin.href} target="_blank" rel="noopener noreferrer" title="Задати ціну в ERP">{margin.text} ↗</a>
            :<span>{margin.text}</span>)}
    </p>
}
