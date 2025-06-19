import { NextRequest } from "next/server";
import { supabase } from "@/lib/SupaBaseClient";

export async function GET(req: NextRequest) {
	const { searchParams } = new URL(req.url);
	const link = searchParams.get("link");
	if (!link) {
		return new Response("Missing link", { status: 400 });
	}
	const handleHide = async () => {
		// update the hidden status in the database
		supabase
			.from("items")
			.update({ hidden: true })
			.eq("link", link)
			.then(({ error }) => {
				if (error) {
					console.error("Error updating item:", error);
				} else {
					// Update the local state or refetch items if necessary
				}
			});
	};
	try {
		await handleHide();
	} catch (error) {
		console.error("Unexpected error:", error);
		return new Response("Error hiding item", { status: 500 });
	}
	return new Response("Item hidden successfully", { status: 200 });
}
