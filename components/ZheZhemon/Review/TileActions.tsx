'use client'
import { useReviewAction } from './useReviewAction'
import type { BoardCard } from '@/lib/reviewBoards'
import styles from './Boards.module.css'

/**
 * One-click reactions on a tile for cards that have no result yet. Outcomes
 * that need a reason (missed, bug) open the card with that option preselected.
 */
export default function TileActions({card,onChanged,onOpen}:{card:BoardCard;onChanged:()=>void;onOpen:(action:'missed'|'bug')=>void}) {
    const {run,pending}=useReviewAction({kind:'delivery',deliveryId:card.delivery_id})
    const apply=async(action:'review_ack'|'set_outcome',payload={})=>{
        const result=await run(action,payload)
        if(result && ['applied','noop','conflict'].includes(result.status))onChanged()
    }
    return <div className={styles.quickActions} role="group" aria-label={`Реакція: ${card.title}`}>
        {!card.first_reaction_at && <button type="button" disabled={!!pending} onClick={()=>apply('review_ack')}>🖐 Опрацьовую</button>}
        <button type="button" disabled={!!pending} onClick={()=>apply('set_outcome',{value:'bought'})}>✅ Купив</button>
        <button type="button" disabled={!!pending} onClick={()=>onOpen('missed')}>⏱ Не встиг</button>
        <button type="button" disabled={!!pending} onClick={()=>apply('set_outcome',{value:'would_hide'})}>🙈 Приховав би</button>
        <button type="button" disabled={!!pending} onClick={()=>onOpen('bug')}>🐞 Баг</button>
    </div>
}
