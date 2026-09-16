'use client'
import {useState} from 'react'
import styles from './Boards.module.css'

type Photo={source_url:string;status:string}
function safePhoto(url:string) {
    try {const u=new URL(url);return u.protocol==='https:' && !u.username && !u.password && (!u.port || u.port==='443') && (u.hostname==='ebayimg.com'||u.hostname.endsWith('.ebayimg.com'))}catch{return false}
}
// Only a non-default status changes what the user can do; url_only is the norm and gets no badge.
const statusNote:Record<string,string>={archived:'є архівна копія; показано зовнішнє джерело',failed:'архівування не вдалося; показано зовнішнє джерело'}
function Photo({photo,index,total,title}:{photo:Photo;index:number;total:number;title:string}) {
    const [failed,setFailed]=useState(false)
    const label=`Фото ${index+1} з ${total}`
    if(!safePhoto(photo.source_url))return <figure><p role="status">{label}: недоступне, непідтримуване джерело.</p></figure>
    return <figure aria-label={label}>
        {failed?<p role="status">Фото недоступне за збереженим URL.</p>:<a href={photo.source_url} target="_blank" rel="noopener noreferrer">
            {/* The snapshot pins the URL, not the remotely hosted bytes. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.source_url} alt={`${label} · ${title}`} loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>
        </a>}
        {failed && <a href={photo.source_url} target="_blank" rel="noopener noreferrer">Відкрити збережений URL ↗</a>}
        {statusNote[photo.status] && <figcaption className={styles.muted}>{statusNote[photo.status]}</figcaption>}
    </figure>
}
export default function PhotoGallery({photos,title}:{photos:Photo[];title:string}) {
    return <div className={styles.subsection} role="group" aria-labelledby="captured-photos">
        <h4 id="captured-photos">Фото оголошення · {photos.length}</h4>
        {photos.length
            ? <div className={styles.gallery}>{photos.map((photo,index)=><Photo key={photo.source_url} photo={photo} index={index} total={photos.length} title={title}/>)}</div>
            : <p className={styles.muted}>Фото у знімку не зафіксовані.</p>}
    </div>
}
