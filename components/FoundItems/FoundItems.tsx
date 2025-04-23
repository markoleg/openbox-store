'use client'
import Link from "next/link"
import { useEffect, useState } from "react"
import { useItems } from '@/context/ItemsProvider'

export default function FoundItems({ id }: { id: number | undefined }) {
    const [loading, setLoading] = useState(true)

    const items = id === undefined ? useItems() : useItems().filter(item => Number(item.search_parameter_id) === Number(id))

    useEffect(() => {
        const timer = setTimeout(() => {
            setLoading(false)
        }, 1000)
        return () => clearTimeout(timer)
    }, [])

    if (loading) {
        return <div>Loading...</div>
    }
    if (!items || items.length === 0) {
        return <div>No items found</div>
    }

    return (
        <div>
            <h1>Found {items.length} items</h1>
            {items.map((item: any, idx: number) => {
                return (
                    <div key={idx}>
                        <Link href={`${item.link}`} key={idx}>{idx + 1}.{item.title}-----${item.price}</Link>
                    </div>
                )
            })}
        </div>
    )
}