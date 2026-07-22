import { NextRequest } from "next/server";
import { supabase } from "@/lib/SupaBaseClient";

// GET /api/shop/hide?link=...
// Hides a shop.app product until its price drops: sets shop_seen.hidden = true
// and hide_price_threshold = current known price (so it resurfaces when cheaper).
export async function GET(req: NextRequest) {
	const link = new URL(req.url).searchParams.get("link");
	if (!link) {
		return new Response("Missing 'link'", { status: 400 });
	}

	// Threshold = current known price (prefer shop_seen.last_price, fall back to snapshot price).
	let threshold: number | null = null;
	const { data: seen } = await supabase
		.from("shop_seen")
		.select("last_price")
		.eq("link", link)
		.maybeSingle();
	threshold = seen?.last_price ?? null;

	if (threshold == null) {
		const { data: prod } = await supabase
			.from("shop_products")
			.select("price")
			.eq("link", link)
			.maybeSingle();
		threshold = prod?.price ?? null;
	}

	const { error } = await supabase
		.from("shop_seen")
		.upsert(
			{ link, hidden: true, hide_price_threshold: threshold },
			{ onConflict: "link" }
		);

	if (error) {
		console.error("Error hiding item:", error.message);
		return new Response("Failed to hide item", { status: 500 });
	}

	return new Response("Item hidden", {
		status: 200,
		headers: { "Content-Type": "text/plain; charset=utf-8" },
	});
}
