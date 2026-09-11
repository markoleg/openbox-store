'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import AsideMenu from '@/components/ZheZhemon/AsideMenu/AsideMenu'
import styles from './Boards.module.css'

export default function ZhezhemonShell({children}:{children:React.ReactNode}) {
    const pathname=usePathname()
    const catalog=pathname==='/zhezhemon' || /^\/zhezhemon\/\d+\/?$/.test(pathname)
    const section=catalog?'catalog':pathname.startsWith('/zhezhemon/not-sent')?'not-sent':'processing'
    return <>
        <nav className={styles.navigation} aria-label="Розділи ZheZhemon">
            {([['catalog','/zhezhemon','Оголошення'],['processing','/zhezhemon/processing','Опрацювання'],['not-sent','/zhezhemon/not-sent','Не надіслано']] as const).map(([key,href,label]) =>
                <Link key={key} href={href} aria-current={section===key?'page':undefined}>{label}</Link>)}
        </nav>
        <div className={catalog?'page-wrp':styles.fullWidth}>{catalog && <AsideMenu/>}{children}</div>
    </>
}
