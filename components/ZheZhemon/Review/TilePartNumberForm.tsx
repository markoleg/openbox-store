'use client'
import {useEffect,useRef,useState} from 'react'
import {PART_NUMBER_PATTERN,normalizePartNumber,type CardPartNumber} from '@/lib/reviewBoards'
import {savePartNumber,explainError} from '@/lib/reviewClient'
import styles from './Boards.module.css'

export default function TilePartNumberForm({link,card,expanded,onClose,onSaved}:{link:string;card:CardPartNumber;expanded:boolean;onClose:()=>void;onSaved:()=>void}) {
    const manual=card.manual_part_number ?? null,version=card.part_number_version ?? null;
    const [base,setBase]=useState({manual,version}),[value,setValue]=useState(manual ?? ''),[pending,setPending]=useState(false),[message,setMessage]=useState('');
    const saving=useRef(false),normalized=normalizePartNumber(value),dirty=normalized!==base.manual;
    const invalid=normalized!==null && !PART_NUMBER_PATTERN.test(normalized);
    const changed=(version ?? -1)>(base.version ?? -1);
    const visible=expanded || !(base.manual || card.part_number) || dirty || pending;
    useEffect(()=>{
        if(!dirty && !pending && (version ?? -1)>=(base.version ?? -1)) {
            setBase({manual,version});setValue(manual ?? '');
        }
    },[manual,version,dirty,pending,base.version]);
    async function save(next:string|null) {
        if(saving.current || changed)return;
        saving.current=true;setPending(true);setMessage('');
        try {
            const result=await savePartNumber({link,partNumber:next,version:base.version});
            if(result.status==='applied' || result.status==='noop') {
                const saved=result.partNumber;
                setBase({manual:saved?.manual_part_number ?? next,version:saved?.version ?? base.version});setValue(saved?.manual_part_number ?? next ?? '');
                setMessage(next?'Збережено.':'Ручне значення прибрано.');
                onClose();
            } else if(result.status==='conflict')setMessage('Номер уже змінено. Онови значення перед збереженням.');
            else setMessage(result.reason==='invalid_part_number'?'Невірний формат номера.':'Не вдалося зберегти номер.');
            if(result.status!=='rejected')onSaved();
        } catch(error) {setMessage(explainError(error))}
        finally {saving.current=false;setPending(false)}
    }
    return <div className={styles.tilePartNumber} hidden={!visible}>
        <form className={styles.tilePartNumberForm} onSubmit={event=>{event.preventDefault();if(!invalid && dirty && normalized!==null)void save(normalized)}}>
            <label><span className={styles.srOnly}>Партійний номер</span><input value={value} disabled={pending} onChange={event=>setValue(event.target.value)}
                maxLength={64} placeholder={card.part_number ?? 'Вказати вручну'} aria-invalid={invalid} autoComplete="off" spellCheck={false}/></label>
            <button type="submit" disabled={pending || changed || invalid || !dirty || normalized===null}>Зберегти</button>
            {base.manual && <button type="button" disabled={pending || changed} onClick={()=>void save(null)}>Очистити</button>}
            {(base.manual || card.part_number) && <button type="button" disabled={pending} aria-label="Закрити редагування партійного" onClick={()=>{setValue(base.manual ?? '');setMessage('');onClose()}}>×</button>}
        </form>
        {invalid && <p className={styles.muted}>3–64 символи: латинські літери, цифри, /, +, -.</p>}
        {changed && dirty && <p className={styles.muted}>Номер змінився в іншому місці. <button type="button" disabled={pending} onClick={()=>{setBase({manual,version});setValue(manual ?? '');setMessage('')}}>Оновити значення</button></p>}
        {message && <p role="status" className={styles.muted}>{message}</p>}
    </div>
}
