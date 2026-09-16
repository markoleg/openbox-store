'use client'
import { usePathname } from 'next/navigation'
import AsideMenu from '@/components/ZheZhemon/AsideMenu/AsideMenu'
import ZhezhemonNavigation, {isCatalogPath} from './ZhezhemonNavigation'
import styles from './Boards.module.css'

export default function ZhezhemonShell({children}:{children:React.ReactNode}) {
    const pathname=usePathname()
    const catalog=isCatalogPath(pathname)
    return <div className={styles.shell}>
        <ZhezhemonNavigation placement="mobile"/>
        <div className={catalog?styles.catalog:styles.fullWidth}>{catalog && <AsideMenu/>}{children}</div>
    </div>
}
