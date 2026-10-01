'use client'
import {useState} from 'react'
import {PanelRight} from 'lucide-react'
import {dateLabel,searchLabel,eventLabels,type BoardCard} from '@/lib/reviewBoards'
import {availablePhotos,type ListingPhoto} from '@/lib/listingPhotos'
import {stockLabel} from '@/lib/reviewStock'
import {outcomeLabels} from '@/lib/reviewKeyboard'
import TileActions from './TileActions'
import TilePartNumberForm from './TilePartNumberForm'
import {ErpPurchaseTag} from './ErpPurchases'
import styles from './Boards.module.css'

export default function NotificationTile({card,onChanged,onOpen,onPhotos}:{card:BoardCard;onChanged:()=>void;onOpen:(action?:'bug')=>void;onPhotos:(photos:ListingPhoto[])=>void}) {
    const photos=availablePhotos(card.photos ?? []),cover=photos[0], [failed,setFailed]=useState<string|null>(null);
    return <article className={styles.tile}>
        <div className={styles.tileHeading}>
            <a className={styles.tileTitle} href={card.link} target="_blank" rel="noopener noreferrer">{card.title}</a>
            <button className={styles.drawerButton} aria-label={`Відкрити картку: ${card.title}`} title="Відкрити картку" onClick={()=>onOpen()}><PanelRight size={17}/></button>
        </div>
        <div className={styles.tileOverview} data-photo={!!cover}>
            {cover && <button className={styles.tilePhoto} aria-label={`Переглянути фото: ${card.title}`} onClick={()=>onPhotos(photos)}>
                {failed===cover.source_url?<span>Фото недоступне</span>:
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cover.source_url} alt={card.title} loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailed(cover.source_url)}/>}
                {photos.length>1 && <span className={styles.photoCount}>{photos.length} фото</span>}
            </button>}
            <div className={styles.tileFacts}>
                <span className={styles.price}>{card.price===null?'Ціна невідома':`${card.price} ${card.currency ?? ''}`}</span>
                <span className={styles.muted}>📦 Кількість на момент сповіщення: {stockLabel(card.stock_quantity)}</span>
                <span className={styles.tags}><span>{eventLabels[card.kind] ?? card.kind}</span><ErpPurchaseTag card={card}/></span>
                <span className={styles.muted}>{dateLabel(card.sent_at)}</span>
                <span className={styles.muted}>Пошук: {searchLabel(card)}</span>
                {card.stage==='processed' && <span>{card.outcome?outcomeLabels[card.outcome]:card.legacy_outcome==='manual_bought'?'Старе «Купив» · без ERP':'Старе «Приховав би»'}</span>}
            </div>
        </div>
        <TilePartNumberForm link={card.link} card={card} onSaved={onChanged}/>
        {card.stage==='new' && <TileActions card={card} onChanged={onChanged} onOpen={onOpen}/>}
    </article>
}
