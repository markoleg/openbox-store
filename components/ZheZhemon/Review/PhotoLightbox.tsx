'use client'
import {useEffect,useRef,useState} from 'react'
import type {ListingPhoto} from '@/lib/listingPhotos'
import styles from './Boards.module.css'

export default function PhotoLightbox({photos,title,onClose}:{photos:ListingPhoto[];title:string;onClose:()=>void}) {
    const [index,setIndex]=useState(0),[failed,setFailed]=useState<string|null>(null);
    const dialog=useRef<HTMLDivElement>(null),closeButton=useRef<HTMLButtonElement>(null),close=useRef(onClose);close.current=onClose;
    useEffect(()=>{
        const prior=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;
        document.body.style.overflow='hidden';closeButton.current?.focus();
        const keyboard=(event:KeyboardEvent)=>{
            if(event.key==='Escape'){event.preventDefault();close.current()}
            if(event.key==='ArrowRight'){event.preventDefault();setIndex(value=>(value+1)%photos.length)}
            if(event.key==='ArrowLeft'){event.preventDefault();setIndex(value=>(value+photos.length-1)%photos.length)}
            if(event.key==='Tab') {
                const buttons=Array.from(dialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []),first=buttons[0],last=buttons.at(-1);
                if(event.shiftKey && document.activeElement===first){event.preventDefault();last?.focus()}
                else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first?.focus()}
            }
        };
        document.addEventListener('keydown',keyboard);
        return ()=>{document.removeEventListener('keydown',keyboard);document.body.style.overflow=overflow;if(prior?.isConnected)prior.focus()};
    },[photos.length]);
    const photo=photos[index];
    return <div className={styles.lightboxOverlay} onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}>
        <div ref={dialog} role="dialog" aria-modal="true" aria-label={`Фото товару: ${title}`} className={styles.lightbox}>
            <div className={styles.lightboxHeader}><strong>{title}</strong><button ref={closeButton} onClick={onClose} aria-label="Закрити фото">×</button></div>
            <div className={styles.lightboxImage}>
                {failed===photo.source_url?<p>Фото недоступне.</p>:
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo.source_url} alt={`Фото ${index+1} з ${photos.length}`} referrerPolicy="no-referrer" onError={()=>setFailed(photo.source_url)}/>}
            </div>
            <div className={styles.lightboxNavigation}>
                <button disabled={photos.length<2} aria-label="Попереднє фото" onClick={()=>setIndex(value=>(value+photos.length-1)%photos.length)}>←</button>
                <span aria-live="polite">{index+1} / {photos.length}</span>
                <button disabled={photos.length<2} aria-label="Наступне фото" onClick={()=>setIndex(value=>(value+1)%photos.length)}>→</button>
            </div>
            {photos.length>1 && <div className={styles.lightboxThumbnails}>{photos.map((item,i)=><button key={item.source_url} aria-label={`Показати фото ${i+1}`} aria-pressed={i===index} onClick={()=>setIndex(i)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.source_url} alt="" loading="lazy" referrerPolicy="no-referrer"/>
            </button>)}</div>}
        </div>
    </div>
}
