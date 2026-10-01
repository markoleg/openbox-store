import {Suspense} from 'react'
import ProcessingBoards from '@/components/ZheZhemon/Review/ProcessingBoards'
export default function ProcessedPage(){return <Suspense fallback={<p>Завантаження…</p>}><ProcessingBoards stage="processed"/></Suspense>}
