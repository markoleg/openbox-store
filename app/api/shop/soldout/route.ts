import { NextRequest } from "next/server";
import { supabase } from "@/lib/SupaBaseClient";

// GET /api/shop/soldout?link=...
// Toggles the manual "sold out" flag on a product (shop_seen.sold_out).
export async function GET(req: NextRequest) {
	const link = new URL(req.url).searchParams.get("link");
	if (!link) {
		return new Response("Missing 'link'", { status: 400 });
	}

	const { data } = await supabase
		.from("shop_seen")
		.select("sold_out")
		.eq("link", link)
		.maybeSingle();

	const next = !(data?.sold_out ?? false);

	const { error } = await supabase
		.from("shop_seen")
		.upsert({ link, sold_out: next }, { onConflict: "link" });

	if (error) {
		console.error("Error toggling sold_out:", error.message);
		return new Response("Failed to update", { status: 500 });
	}

	return new Response(`sold_out = ${next}`, {
		status: 200,
		headers: { "Content-Type": "text/plain; charset=utf-8" },
	});
}
