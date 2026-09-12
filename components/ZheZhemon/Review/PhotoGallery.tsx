'use client'
import {useState} from 'react'
import styles from './Boards.module.css'

function safePhoto(url:string) {
    try {const u=new URL(url);return u.protocol==='https:' && !u.username && !u.password && (!u.port || u.port==='443') && (u.hostname==='ebayimg.com'||u.hostname.endsWith('.ebayimg.com'))}catch{return false}
}
function Photo({photo}:{photo:{source_url:string;status:string}}) {
    const [failed,setFailed]=useState(false)
    if(!safePhoto(photo.source_url))return <figure><p>Фото недоступне: непідтримуване джерело.</p></figure>
    return <figure>
        {failed?<p role="status">Фото недоступне за збереженим URL.</p>:<a href={photo.source_url} target="_blank" rel="noopener noreferrer">
            {/* The snapshot pins the URL, not the remotely hosted bytes. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.source_url} alt="Фото зі знімка оголошення" loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>
        </a>}
        {failed && <a href={photo.source_url} target="_blank" rel="noopener noreferrer">Відкрити збережений URL ↗</a>}
        <figcaption className={styles.muted}>Фото з eBay · {photo.status==='archived'?'є окрема архівна копія, тут показано зовнішнє джерело':'збережено URL, власна копія не потрібна'}</figcaption>
    </figure>
}
export default function PhotoGallery({photos}:{photos:{source_url:string;status:string}[]}) {
    return <><p className={styles.muted}>Зберігаємо URL фото. Доступність і незмінність зображень на eBay не гарантовані.</p>
        <div className={styles.gallery}>{photos.map(photo=><Photo key={photo.source_url} photo={photo}/>)}</div>
        {!photos.length && <p className={styles.muted}>Фото у знімку недоступні.</p>}
    </>
}
