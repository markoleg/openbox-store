import { NextRequest } from "next/server";
import { supabase } from "@/lib/SupaBaseClient";

// GET /api/shop/ban?link=...
// Permanently bans a shop.app product: sets shop_seen.banned = true (persists,
// so the parser ignores it forever) and removes it from the current snapshot.
export async function GET(req: NextRequest) {
	const link = new URL(req.url).searchParams.get("link");
	if (!link) {
		return new Response("Missing 'link'", { status: 400 });
	}

	try {
		const { error: upErr } = await supabase
			.from("shop_seen")
			.upsert({ link, banned: true }, { onConflict: "link" });

		if (upErr) {
			console.error("Error banning (shop_seen):", upErr.message);
			return new Response("Failed to ban item", { status: 500 });
		}

		// Drop it from the current snapshot so it disappears from the dashboard now.
		await supabase.from("shop_products").delete().eq("link", link);
	} catch (error) {
		console.error("Unexpected error banning item:", error);
		return new Response("Error banning item", { status: 500 });
	}

	return new Response("Item banned", {
		status: 200,
		headers: { "Content-Type": "text/plain; charset=utf-8" },
	});
}
