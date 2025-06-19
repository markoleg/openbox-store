import { NextRequest } from "next/server";
import { supabase } from "@/lib/SupaBaseClient";

export async function GET(req: NextRequest) {
	const { searchParams } = new URL(req.url);
	const link = searchParams.get("link");

	if (!link) {
		return new Response(JSON.stringify({ error: "Missing 'link' parameter" }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}

	const { data, error } = await supabase
		.from("items")
		.update({ hidden: true })
		.eq("link", link)
		.select(); // this returns the updated rows

	if (error) {
		console.error("Supabase update error:", error.message);
		return new Response(JSON.stringify({ error: "Failed to hide item" }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}

	if (!data || data.length === 0) {
		return new Response(JSON.stringify({ error: "Item not found" }), {
			status: 404,
			headers: { "Content-Type": "application/json" },
		});
	}

	return new Response(JSON.stringify({ message: "Item hidden successfully" }), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	});
}
