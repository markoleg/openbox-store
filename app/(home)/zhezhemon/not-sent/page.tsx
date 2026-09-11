import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireOwnerSession } from '@/lib/server/owner'
import { reviewCommandsEnabled, reviewDatabase } from '@/lib/server/reviewCommands'
import { isUuid } from '@/lib/reviewCommands'
import { dateLabel } from '@/lib/reviewBoards'
import styles from '@/components/ZheZhemon/Review/Boards.module.css'

export const dynamic='force-dynamic'
const states:Record<string,string>={awaiting_preflight:'Очікує перевірки',ready:'Готове до відправки',sending:'Відправляється',retry_wait:'Очікує повторної спроби',failed:'Помилка відправки',unknown:'Результат невідомий',suppressed:'Відсіяно',cancelled:'Скасовано',superseded:'Замінено новою подією'}
type Params={state?:string;at?:string;id?:string}
export default async function NotSentPage({searchParams}:{searchParams:Promise<Params>}) {
    const params=await searchParams
    try{await requireOwnerSession()}catch{redirect(`/login?next=${encodeURIComponent('/zhezhemon/not-sent?'+new URLSearchParams(params))}`)}
    if(!reviewCommandsEnabled())return <main className={styles.workspace}><h1>Не надіслано</h1><p className={styles.error}>Журнал ще не ввімкнено на сервері.</p></main>
    if((params.state && !states[params.state]) || (!!params.id!==!!params.at) || (params.id && (!isUuid(params.id)||!params.at||!/^\d{4}-\d{2}-\d{2}T[\d:.+-]+Z?$/.test(params.at)||!Number.isFinite(Date.parse(params.at)))))return <main>Некоректний фільтр або курсор.</main>
    let rows, count
    try{
        const db=reviewDatabase()
        let query=db.from('review_not_sent_rows').select('*').order('created_at',{ascending:false}).order('id',{ascending:false}).limit(50)
        let total=db.from('review_not_sent_rows').select('id',{head:true,count:'exact'})
        if(params.state){query=query.eq('state',params.state);total=total.eq('state',params.state)}
        if(params.at && params.id){const at=new Date(params.at).toISOString();query=query.or(`created_at.lt.${at},and(created_at.eq.${at},id.lt.${params.id})`)}
        const [page,all]=await Promise.all([query,total])
        if(page.error || all.error)throw new Error('storage')
        rows=page.data ?? [];count=all.count ?? 0
    }catch{return <main className={styles.workspace}><h1>Не надіслано</h1><p className={styles.error}>Не вдалося прочитати журнал. Перевір міграції та конфігурацію сервера.</p></main>}
    const last=rows.at(-1)
    return <main className={styles.workspace}>
        <h1>Не надіслано · {count}</h1><p className={styles.muted}>Технічний журнал намірів відправки, не задачі закупщику й не втрачені закупівлі. Один лот може мати окремий стан для кожного чату. Unknown не надсилається повторно автоматично.</p>
        <form className={styles.filters}><label>Стан<select name="state" defaultValue={params.state ?? ''}><option value="">Усі</option>{Object.entries(states).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label><button>Застосувати</button><Link href="/zhezhemon/not-sent">На початок</Link></form>
        <div className={styles.tableScroll}><table className={styles.technical}><thead><tr><th>Коли / оголошення</th><th>Чат / пошук</th><th>Стан / причина</th><th>Перевірка / наступна спроба</th></tr></thead><tbody>
            {rows.map(row=><tr key={row.id}><td>{dateLabel(row.created_at)}<p><Link href={`/zhezhemon/history?${new URLSearchParams({event:row.event_id})}`}>{row.title}</Link></p></td><td>{row.channel}<p>{row.search_name ?? 'Пошук видалено'}</p></td><td>{states[row.state] ?? row.state}<p>{row.suppression_reason ?? row.preflight_status}</p></td><td>{dateLabel(row.checked_at)}<p>{dateLabel(row.next_check_at ?? row.next_attempt_at)}</p>Спроб: {row.attempt_count}</td></tr>)}
        </tbody></table></div>
        {!rows.length && <p className={styles.empty}>Записів немає.</p>}
        {rows.length===50 && last && <Link className={styles.button} href={`/zhezhemon/not-sent?${new URLSearchParams({...params,at:last.created_at,id:last.id})}`}>Наступні 50</Link>}
    </main>
}
