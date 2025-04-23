import Link from "next/link"

export default function FoundItems({ items }: { items: any }) {
    if (!items || items.length === 0) {
        return <div>No items found</div>
    }
    const sortedItems = items.sort((a: any, b: any) => {
        const priceA = parseFloat(a.price + a.shipping_cost);
        const priceB = parseFloat(b.price + b.shipping_cost);
        return priceA - priceB;
    });
    return (
        <div>
            <h1>Found {items.length} items</h1>
            {sortedItems.map((item: any, idx: number) => {
                return (
                    <div key={idx}>
                        <Link href={`${item.link}`} key={idx}>{idx + 1}.{item.title}-----${item.price}</Link>
                    </div>
                )
            })}
        </div>
    )
}