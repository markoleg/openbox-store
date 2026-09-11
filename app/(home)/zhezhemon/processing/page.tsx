import { Suspense } from 'react'
import ProcessingBoards from '@/components/ZheZhemon/Review/ProcessingBoards'

export default function ProcessingPage() {
    return <Suspense fallback={<p>Завантаження…</p>}><ProcessingBoards/></Suspense>
}
