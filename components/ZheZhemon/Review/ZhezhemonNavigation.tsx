'use client'
import Link from 'next/link'
import {usePathname} from 'next/navigation'
import styles from './Boards.module.css'

const sections = [
    ['catalog', '/zhezhemon', 'Оголошення'],
    ['processing', '/zhezhemon/processing', 'Опрацювання'],
    ['not-sent', '/zhezhemon/not-sent', 'Не надіслано'],
] as const

export function isCatalogPath(path:string) {
    return path==='/zhezhemon' || /^\/zhezhemon\/\d+\/?$/.test(path)
}

export default function ZhezhemonNavigation({placement}:{placement:'header'|'mobile'}) {
    const pathname=usePathname()
    if(pathname!=='/zhezhemon' && !pathname.startsWith('/zhezhemon/'))return null
    const section=isCatalogPath(pathname)?'catalog':pathname.startsWith('/zhezhemon/not-sent')?'not-sent':'processing'
    return <nav className={`${styles.navigation} ${placement==='header'?styles.headerNavigation:styles.mobileNavigation}`} aria-label="Розділи ZheZhemon">
        {sections.map(([key,href,label])=><Link key={key} href={href} aria-current={section===key?'page':undefined}>{label}</Link>)}
    </nav>
}
